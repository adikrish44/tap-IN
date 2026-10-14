'use strict';
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const WebSocket=require('ws');
const PORT=Number(process.env.PORT||3000),ROOT=path.join(__dirname,'../web');
const rooms=new Map(),clients=new Map();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');const rel=u.pathname==='/'?'/index.html':u.pathname;
 const filename=path.resolve(ROOT,'.'+decodeURIComponent(rel));
 if(!filename.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(filename,(e,data)=>{if(e){res.writeHead(404);return res.end('Not found')}
 res.writeHead(200,{'content-type':types[path.extname(filename)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(data)})
});
const wss=new WebSocket.Server({server,path:'/socket'});
const send=(ws,obj)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))};
const broadcast=(room,obj)=>{for(const c of room.members.values())send(c.ws,obj)};
const publicRoom=r=>({pin:r.pin,queue:r.queue,selected:r.selected,playing:r.playing,position:r.position,updatedAt:r.updatedAt,members:[...r.members.values()].map(m=>({id:m.id,name:m.name,role:m.role})),chat:r.chat.slice(-100),talker:r.talker});
const error=(ws,message)=>send(ws,{type:'error',message});
const allowedUrl=raw=>{try{const u=new URL(raw);if(u.protocol!=='https:')return false;const h=u.hostname.toLowerCase();return h==='youtu.be'||['youtube.com','www.youtube.com','m.youtube.com'].includes(h)||h==='drive.google.com'}catch{return false}};
function closeMembership(ws){const c=clients.get(ws);if(!c)return;clients.delete(ws);const r=rooms.get(c.room);if(!r)return;r.members.delete(c.id);if(r.talker===c.id)r.talker=null;if(c.role==='host'){broadcast(r,{type:'ended'});rooms.delete(c.room)}else broadcast(r,{type:'state',room:publicRoom(r)})}
function makePin(){let pin;do{pin=String(crypto.randomInt(0,10000)).padStart(4,'0')}while(rooms.has(pin));return pin}
function authorize(c,r,hostOnly=false){return c&&r&&(hostOnly?c.role==='host':c.role==='host'||c.role==='admin')}
wss.on('connection',ws=>{
 ws.on('message',data=>{
  if(data.length>16000)return error(ws,'Message too large');
  let m;try{m=JSON.parse(data.toString())}catch{return error(ws,'Invalid JSON')}
  if(!m||typeof m.type!=='string')return;
  if(m.type==='create'){if(clients.has(ws))return error(ws,'Already in station');const pin=makePin(),id=crypto.randomUUID();const member={ws,id,name:String(m.name||'Host').slice(0,30),role:'host'};const r={pin,created:Date.now(),expires:Date.now()+120000,members:new Map([[id,member]]),queue:[],selected:null,playing:false,position:0,updatedAt:Date.now(),chat:[],talker:null};rooms.set(pin,r);clients.set(ws,{id,room:pin,role:'host'});send(ws,{type:'joined',id,role:'host',room:publicRoom(r)});return}
  if(m.type==='join'){if(clients.has(ws))return error(ws,'Already in station');const r=rooms.get(String(m.pin||''));if(!r)return error(ws,'Station PIN not found');const id=crypto.randomUUID(),member={ws,id,name:String(m.name||'Listener').slice(0,30),role:'listener'};r.members.set(id,member);clients.set(ws,{id,room:r.pin,role:'listener'});send(ws,{type:'joined',id,role:'listener',room:publicRoom(r)});broadcast(r,{type:'state',room:publicRoom(r)});return}
  const c=clients.get(ws);if(!c)return error(ws,'Join a station first');const r=rooms.get(c.room);if(!r)return error(ws,'Station ended');
  if(m.type==='chat'){const message=String(m.message||'').trim().slice(0,500);if(!message)return;r.chat.push({id:crypto.randomUUID(),from:c.id,name:r.members.get(c.id).name,text:message,at:Date.now()});r.chat=r.chat.slice(-100);broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='request-admin'){if(c.role!=='listener')return;r.pending=r.pending||new Set();r.pending.add(c.id);for(const member of r.members.values())if(member.role==='host')send(member.ws,{type:'admin-request',id:c.id,name:r.members.get(c.id).name});return}
  if(m.type==='admin'){if(!authorize(c,r,true))return error(ws,'Host only');const target=r.members.get(String(m.id));if(!target||target.role==='host')return;target.role=m.grant?'admin':'listener';const targetC=clients.get(target.ws);if(targetC)targetC.role=target.role;send(target.ws,{type:'role',role:target.role});broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='queue-add'){if(!authorize(c,r))return error(ws,'Admin access required');const url=String(m.url||'');if(!allowedUrl(url))return error(ws,'Unsupported URL');r.queue.push({id:crypto.randomUUID(),title:String(m.title||'New track').slice(0,120),url,source:/youtu/.test(new URL(url).hostname)?'YouTube':'Google Drive'});broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='queue-remove'){if(!authorize(c,r))return;r.queue=r.queue.filter(t=>t.id!==m.id);broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='queue-move'){if(!authorize(c,r))return;const i=r.queue.findIndex(t=>t.id===m.id),j=i+Number(m.direction);if(i>=0&&j>=0&&j<r.queue.length&&Math.abs(Number(m.direction))===1){[r.queue[i],r.queue[j]]=[r.queue[j],r.queue[i]];broadcast(r,{type:'state',room:publicRoom(r)})}return}
  if(m.type==='playback'){if(!authorize(c,r))return;r.selected=r.queue.some(t=>t.id===m.selected)?m.selected:r.selected;r.playing=!!m.playing;r.position=Math.max(0,Math.min(Number(m.position)||0,86400));r.updatedAt=Date.now();broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='ptt'){if(!r.members.has(c.id))return;if(m.active){if(r.talker&&r.talker!==c.id)return error(ws,'Microphone channel busy');r.talker=c.id}else if(r.talker===c.id)r.talker=null;broadcast(r,{type:'state',room:publicRoom(r)});return}
  if(m.type==='signal'){const target=r.members.get(String(m.to));if(target&&JSON.stringify(m.payload||{}).length<8000)send(target.ws,{type:'signal',from:c.id,payload:m.payload});return}
 });
 ws.on('close',()=>closeMembership(ws));ws.on('error',()=>closeMembership(ws));
});
setInterval(()=>{for(const r of [...rooms.values()]){if(Date.now()<r.expires)continue;rooms.delete(r.pin);r.pin=makePin();r.expires=Date.now()+120000;rooms.set(r.pin,r);broadcast(r,{type:'state',room:publicRoom(r)})}},5000);
server.listen(PORT,()=>console.log('chimpanzee listening on '+PORT));
