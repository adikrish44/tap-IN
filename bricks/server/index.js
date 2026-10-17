'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {WebSocket, WebSocketServer} = require('ws');
const ROOT = path.resolve(__dirname, '../web');
const PORT = Number(process.env.PORT || 3000);
const BEATS = new Set(['afterglow','plastic-sun','orbit','midnight-build','stereo-city','soft-edges']);
const rooms = new Map();
const pinIndex = new Map();
const clients = new WeakMap();
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};

/* Ephemeral station media: explicit Host uploads, bounded RAM, member-only HTTP playback. */
const MAX_TRACK_BYTES=25*1024*1024,MAX_ROOM_BYTES=75*1024*1024,MAX_GLOBAL_BYTES=250*1024*1024;
const MAX_FILE_TRACKS_PER_ROOM=8;
const mediaIndex=new Map();
let mediaBytes=0;
const permittedOrigins=new Set((process.env.ALLOWED_ORIGINS||'https://adikrish44.github.io,https://localhost,capacitor://localhost,http://localhost:3000').split(',').map(x=>x.trim()).filter(Boolean));
function cors(req,res) {
  const origin=req.headers.origin;
  if(!origin)return true;
  if(!permittedOrigins.has(origin))return false;
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Audio-Title,Range');
  return true;
}
function memberForToken(room,token){if(!room||!/^[0-9a-f]{48}$/.test(token||''))return null;
  for(const m of room.members.values())if(m.mediaToken===token)return m;
  return null;
}
const failHttp=(res,code,message)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:message}))};
function releaseAsset(room,assetId) {
  const asset=mediaIndex.get(assetId);
  if(!asset||asset.roomId!==room.id)return;
  mediaIndex.delete(assetId);mediaBytes=Math.max(0,mediaBytes-asset.data.length);
  room.mediaBytes=Math.max(0,room.mediaBytes-asset.data.length);
}
function sniffAudio(data,type) {
  if(!data||data.length<12)return false;
  const four=data.toString('ascii',0,4);
  const mp3=(four==='ID3'||(data[0]===0xff&&(data[1]&0xe0)===0xe0));
  if(['audio/mpeg','audio/mp3'].includes(type))return mp3;
  if(['audio/mp4','audio/x-m4a','audio/m4a'].includes(type))return data.toString('ascii',4,8)==='ftyp';
  if(['audio/wav','audio/wave','audio/x-wav'].includes(type))return four==='RIFF'&&data.toString('ascii',8,12)==='WAVE';
  if(['audio/ogg','application/ogg'].includes(type))return four==='OggS';
  if(['audio/flac','audio/x-flac'].includes(type))return four==='fLaC';
  if(['audio/aac'].includes(type))return data[0]===0xff&&(data[1]&0xf0)===0xf0;
  if(['audio/webm'].includes(type))return data.readUInt32BE(0)===0x1a45dfa3;
  return false;
}
async function uploadMedia(req,res,roomId) {
  if(!cors(req,res))return failHttp(res,403,'Origin is not allowed');
  const room=rooms.get(roomId);
  const token=(req.headers.authorization||'').match(/^Bearer ([0-9a-f]{48})$/)?.[1];
  const member=memberForToken(room,token);
  if(!member||member.role!=='host')return failHttp(res,403,'Only the host may upload audio to this station');
  const len=Number(req.headers['content-length']);
  if(!Number.isSafeInteger(len)||len<12||len>MAX_TRACK_BYTES)return failHttp(res,413,'Audio file must be 12 bytes to 25 MB');
  if(room.queue.length>=80||room.queue.filter(t=>t.kind==='station-file').length>=MAX_FILE_TRACKS_PER_ROOM)return failHttp(res,409,'Station upload limit reached');
  if(room.mediaBytes+len>MAX_ROOM_BYTES||mediaBytes+len>MAX_GLOBAL_BYTES)return failHttp(res,507,'Station media memory limit reached');
  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  const buffers=[];let received=0;
  try {
    for await(const chunk of req){received+=chunk.length;if(received>MAX_TRACK_BYTES||received>len)return failHttp(res,413,'Audio upload too large');buffers.push(chunk)}
  }catch{return}
  if(received!==len)return failHttp(res,400,'Incomplete upload');
  const data=Buffer.concat(buffers);
  if(!sniffAudio(data,type))return failHttp(res,415,'Unsupported audio file format or content');
  if(!rooms.has(roomId)||roleOf(room,member.id)!=='host')return failHttp(res,410,'Station has ended');
  if(room.mediaBytes+received>MAX_ROOM_BYTES||mediaBytes+received>MAX_GLOBAL_BYTES)return failHttp(res,507,'Media upload capacity reached');
  const assetId=crypto.randomUUID(),trackId=crypto.randomUUID();
  let rawTitle=String(req.headers['x-audio-title']||'Host audio');try{rawTitle=decodeURIComponent(rawTitle)}catch{}const title=clean(rawTitle,80)||'Host audio';
  mediaIndex.set(assetId,{roomId,data,type});
  mediaBytes+=data.length;room.mediaBytes+=data.length;
  room.queue.push({id:trackId,kind:'station-file',assetId,title,artist:'Music shared by host',size:data.length});
  if(!room.playback.trackId)room.playback={trackId,playing:false,offsetMs:0,at:now()};
  sync(room);
  res.writeHead(201,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({ok:true,trackId,assetId,title,size:data.length}));
}
function streamMedia(req,res,assetId,url){
  if(!cors(req,res))return failHttp(res,403,'Origin is not allowed');
  const asset=mediaIndex.get(assetId),room=asset&&rooms.get(asset.roomId);
  if(!asset||!room)return failHttp(res,404,'Audio unavailable');
  if(!memberForToken(room,url.searchParams.get('access')))return failHttp(res,403,'Join the station to hear this audio');
  const size=asset.data.length,range=req.headers.range;
  let start=0,end=size-1,code=200;
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match)return failHttp(res,416,'Invalid audio range');
    if(!match[1]){const suffix=Number(match[2]);if(!suffix)return failHttp(res,416,'Invalid audio range');start=Math.max(0,size-suffix)}
    else start=Number(match[1]);
    if(match[1]&&match[2])end=Math.min(size-1,Number(match[2]));
    if(start>=size||end<start)return failHttp(res,416,'Audio range unavailable');
    code=206;
  }
  const headers={'content-type':asset.type,'accept-ranges':'bytes','content-length':end-start+1,'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
  if(code===206)headers['content-range']=`bytes ${start}-${end}/${size}`;
  res.writeHead(code,headers);
  res.end(req.method==='HEAD'?undefined:asset.data.subarray(start,end+1));
}

const now=()=>Date.now();
const clean=(s,max=200)=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const tell=(ws,payload)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload))};
function makePin(){let pin;do{pin=String(crypto.randomInt(0,10000)).padStart(4,'0')}while(pinIndex.has(pin));return pin;}
function emit(room,payload){for(const m of room.members.values())tell(m.ws,payload)}
function roleOf(room,id){return room.members.get(id)?.role||null}
function canEdit(room,id){return ['host','admin'].includes(roleOf(room,id))}
function publicRoom(room){return {
  id:room.id,pin:room.pin,pinExpires:room.pinExpires,name:room.name,createdAt:room.createdAt,
  queue:room.queue,playback:room.playback,folders:room.folders,
  members:[...room.members].map(([id,m])=>({id,name:m.name,role:m.role,joinedAt:m.joinedAt})),
  requests:[...room.requests],chat:room.chat.slice(-80),reactions:room.reactions.slice(-10),serverTime:now()
}}
function sync(room){emit(room,{type:'state',room:publicRoom(room)})}
function bad(ws,message){tell(ws,{type:'error',message})}
function safeUrl(raw){try{const u=new URL(raw);if(u.protocol!=='https:' || u.username||u.password)return null;return u;}catch{return null}}
function youtubeId(u){if(!u)return null;const h=u.hostname.toLowerCase();let id=null;if(h==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(['www.youtube.com','youtube.com','m.youtube.com'].includes(h))id=u.searchParams.get('v')||u.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1];return /^[\w-]{11}$/.test(id||'')?id:null}
function parseTrack(t){if(!t||typeof t!=='object')return null;const id=crypto.randomUUID();if(t.kind==='beat'&&BEATS.has(t.beat))return {id,kind:'beat',beat:t.beat,title:clean(t.title,60)||'Brick beat',artist:'Chimpanzee Sound Lab'};
  const u=safeUrl(t.url);if(!u)return null;
  if(t.kind==='youtube'){const videoId=youtubeId(u);if(!videoId)return null;return {id,kind:'youtube',url:`https://www.youtube.com/watch?v=${videoId}`,videoId,title:clean(t.title,80)||'YouTube video',artist:'Official YouTube player'}}
  if(t.kind==='audio'&&/\.(mp3|m4a|aac|ogg|wav|opus)(\?|$)/i.test(u.pathname+u.search))return {id,kind:'audio',url:u.toString(),title:clean(t.title,80)||decodeURIComponent(u.pathname.split('/').pop()).slice(0,80),artist:'Shared audio link'};
  return null;
}
function closeRoom(room){rooms.delete(room.id);pinIndex.delete(room.pin);for(const t of room.queue)if(t.kind==='station-file')releaseAsset(room,t.assetId);emit(room,{type:'ended'});for(const m of room.members.values())clients.delete(m.ws);room.members.clear()}
function leave(ws){const c=clients.get(ws);if(!c)return;clients.delete(ws);const room=rooms.get(c.roomId);if(!room)return;room.members.delete(c.id);room.requests.delete(c.id);if(c.id===room.hostId){closeRoom(room)}else sync(room)}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const upload=u.pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})\/tracks$/);
  const media=u.pathname.match(/^\/api\/media\/([a-f0-9-]{36})$/);
  if((upload||media)&&req.method==='OPTIONS'){if(!cors(req,res))return failHttp(res,403,'Origin not allowed');res.writeHead(204);res.end();return}
  if(upload&&req.method==='POST'){uploadMedia(req,res,upload[1]).catch(()=>{if(!res.headersSent)failHttp(res,500,'Upload error')});return}
  if(media&&['GET','HEAD'].includes(req.method)){streamMedia(req,res,media[1],u);return}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
  if(u.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return}
  const target=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!target.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(target,(err,data)=>{
    if(err){res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return}
    const headers={'content-type':MIME[path.extname(target)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY'};
    res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:data)
  })
});
const wss=new WebSocketServer({server,path:'/socket',maxPayload:12*1024});
wss.on('connection',(ws,req)=>{
  const requestIP=(req.socket.remoteAddress||'unknown');
  const budget={count:0,reset:now()+10000};
  ws.on('message',raw=>{
    if(now()>budget.reset){budget.count=0;budget.reset=now()+10000}
    if(++budget.count>35)return bad(ws,'Slow down a little.');
    let m;try{m=JSON.parse(raw.toString())}catch{return bad(ws,'Invalid message')}
    if(!m||typeof m.type!=='string')return;
    if(m.type==='ping'){tell(ws,{type:'pong',echo:Number(m.time)||0,serverTime:now()});return}
    if(m.type==='create'){
      if(clients.has(ws))return bad(ws,'Already in a room');
      const name=clean(m.name,25)||'Builder',roomName=clean(m.roomName,36)||'The Brickroom';
      const id=crypto.randomUUID(),rid=crypto.randomUUID(),pin=makePin();
      const room={id:rid,hostId:id,name:roomName,pin,pinExpires:now()+120000,createdAt:now(),members:new Map(),requests:new Set(),queue:[],chat:[],reactions:[],folders:[],mediaBytes:0,playback:{trackId:null,playing:false,offsetMs:0,at:now()}};
      const mediaToken=crypto.randomBytes(24).toString('hex');room.members.set(id,{id,ws,name,role:'host',joinedAt:now(),mediaToken});rooms.set(rid,room);pinIndex.set(pin,rid);clients.set(ws,{id,roomId:rid,ip:requestIP});tell(ws,{type:'joined',id,role:'host',mediaToken,room:publicRoom(room)});return;
    }
    if(m.type==='join'){
      if(clients.has(ws))return bad(ws,'Already in a room');
      const rid=pinIndex.get(clean(m.pin,4));const room=rid&&rooms.get(rid);
      if(!room)return bad(ws,'That PIN is expired or incorrect');
      if(room.members.size>=30)return bad(ws,'This room is full (30 listeners maximum)');
      const id=crypto.randomUUID(),name=clean(m.name,25)||'Listener';
      const mediaToken=crypto.randomBytes(24).toString('hex');room.members.set(id,{id,ws,name,role:'listener',joinedAt:now(),mediaToken});clients.set(ws,{id,roomId:rid,ip:requestIP});tell(ws,{type:'joined',id,role:'listener',mediaToken,room:publicRoom(room)});sync(room);return;
    }
    const c=clients.get(ws);if(!c)return bad(ws,'Join or create a station first');
    const room=rooms.get(c.roomId);if(!room)return bad(ws,'Station has ended');
    const edit=canEdit(room,c.id),host=c.id===room.hostId;
    switch(m.type){
      case 'chat': {const message=clean(m.text,400);if(!message)return;room.chat.push({id:crypto.randomUUID(),from:c.id,name:room.members.get(c.id).name,text:message,at:now()});room.chat=room.chat.slice(-80);sync(room);break}
      case 'react': {const allowed=['🧱','🔥','💜','🎵','⚡','✨'];if(!allowed.includes(m.emoji))return;room.reactions.push({id:crypto.randomUUID(),from:c.id,emoji:m.emoji,at:now()});room.reactions=room.reactions.slice(-20);emit(room,{type:'reaction',emoji:m.emoji,from:c.id});break}
      case 'request-admin': {if(roleOf(room,c.id)!=='listener')return;room.requests.add(c.id);sync(room);break}
      case 'role': {if(!host)return bad(ws,'Host only');const member=room.members.get(clean(m.memberId,50));if(!member||member.role==='host')return;member.role=m.grant?'admin':'listener';room.requests.delete(member.id);tell(member.ws,{type:'role',role:member.role});sync(room);break}
      case 'queue-add': {if(!edit)return bad(ws,'Admin access required');if(room.queue.length>=80)return bad(ws,'Queue is full');const track=parseTrack(m.track);if(!track)return bad(ws,'Track must be a built-in beat, a direct HTTPS audio URL, or a YouTube link');room.queue.push(track);if(!room.playback.trackId){room.playback={trackId:track.id,playing:false,offsetMs:0,at:now()}}sync(room);break}
      case 'queue-remove': {if(!edit)return bad(ws,'Admin access required');const id=clean(m.trackId,50);for(const t of room.queue)if(t.id===id&&t.kind==='station-file')releaseAsset(room,t.assetId);room.queue=room.queue.filter(t=>t.id!==id);if(room.playback.trackId===id){room.playback={trackId:room.queue[0]?.id||null,playing:false,offsetMs:0,at:now()}}sync(room);break}
      case 'queue-move': {if(!edit)return bad(ws,'Admin access required');const i=room.queue.findIndex(t=>t.id===m.trackId),d=Number(m.direction);if(i<0||![-1,1].includes(d)||i+d<0||i+d>=room.queue.length)return;[room.queue[i],room.queue[i+d]]=[room.queue[i+d],room.queue[i]];sync(room);break}
      case 'playback': {if(!edit)return bad(ws,'Admin access required');const requested=room.queue.find(t=>t.id===m.trackId);if(!requested)return bad(ws,'Choose a track first');let position=Math.max(0,Math.min(3600000,Number(m.offsetMs)||0));room.playback={trackId:requested.id,playing:!!m.playing,offsetMs:position,at:now()+180};sync(room);break}
      case 'folder-add': {if(!edit)return bad(ws,'Admin access required');const u=safeUrl(m.url);if(!u||u.hostname!=='drive.google.com'||!/^\/drive\/folders\//.test(u.pathname))return bad(ws,'Enter a shared Google Drive folder link');if(room.folders.length>=12)return bad(ws,'Maximum 12 folder links');room.folders.push({id:crypto.randomUUID(),url:u.toString(),title:clean(m.title,45)||`Folder ${room.folders.length+1}`});sync(room);break}
      case 'folder-remove': {if(!edit)return bad(ws,'Admin access required');room.folders=room.folders.filter(f=>f.id!==m.id);sync(room);break}
      case 'end': {if(!host)return bad(ws,'Host only');closeRoom(room);break}
      default: break;
    }
  });
  ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
});
const ticker=setInterval(()=>{for(const room of rooms.values()){
  if(now()>=room.pinExpires){pinIndex.delete(room.pin);room.pin=makePin();pinIndex.set(room.pin,room.id);room.pinExpires=now()+120000;sync(room)}
}},1000);ticker.unref();
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`/chimpanzee BRICKS available on http://localhost:${PORT}`));
module.exports={server,rooms,wss,parseTrack,youtubeId,safeUrl,publicRoom,sniffAudio};