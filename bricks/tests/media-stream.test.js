'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {WebSocket}=require('ws');
const {server,wss,sniffAudio}=require('../server/index.js');

function wavSample(){
 const bytes=Buffer.alloc(512);
 bytes.write('RIFF',0,'ascii');bytes.writeUInt32LE(504,4);bytes.write('WAVE',8,'ascii');
 bytes.write('fmt ',12,'ascii');bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);
 bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36,'ascii');bytes.writeUInt32LE(468,40);
 return bytes;
}
function nextMessage(ws,predicate,timeoutMs=3000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Timed out waiting for websocket message'))},timeoutMs);
  const listener=raw=>{let m;try{m=JSON.parse(raw)}catch{return}
   if(predicate(m)){clearTimeout(timer);ws.off('message',listener);resolve(m)}
  };
  ws.on('message',listener);
 });
}
async function connectedSocket(url){
 const ws=new WebSocket(url);await once(ws,'open');return ws;
}
test('station audio: Host upload, private listener playback, byte-range seeking, cleanup',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const base='http://127.0.0.1:'+port;
 const wsUrl='ws://127.0.0.1:'+port+'/socket';
 const sockets=[];
 t.after(async()=>{
  for(const ws of sockets){if(ws.readyState!==WebSocket.CLOSED)ws.terminate()}
  await new Promise(resolve=>wss.close(resolve));
  await new Promise(resolve=>server.close(resolve));
 });
 const host=await connectedSocket(wsUrl);sockets.push(host);
 const readyHost=nextMessage(host,m=>m.type==='joined');
 host.send(JSON.stringify({type:'create',name:'Studio Host'}));
 const hostRoom=await readyHost;
 assert.equal(hostRoom.role,'host');
 assert.match(hostRoom.mediaToken,/^[a-f0-9]{48}$/);

 const listener=await connectedSocket(wsUrl);sockets.push(listener);
 const readyListener=nextMessage(listener,m=>m.type==='joined');
 listener.send(JSON.stringify({type:'join',name:'Listener',pin:hostRoom.room.pin}));
 const listenerRoom=await readyListener;
 assert.equal(listenerRoom.role,'listener');
 assert.notEqual(listenerRoom.mediaToken,hostRoom.mediaToken);

 const bytes=wavSample();
 assert.equal(sniffAudio(bytes,'audio/wav'),true);
 assert.equal(sniffAudio(Buffer.from('not valid audio data'),'audio/wav'),false);
 const postURL=base+'/api/rooms/'+hostRoom.room.id+'/tracks';
 const listenerUpload=await fetch(postURL,{method:'POST',headers:{authorization:'Bearer '+listenerRoom.mediaToken,'content-type':'audio/wav'},body:bytes});
 assert.equal(listenerUpload.status,403);
 const updateListener=nextMessage(listener,m=>m.type==='state'&&m.room.queue.some(x=>x.kind==='station-file'));
 const upload=await fetch(postURL,{method:'POST',headers:{authorization:'Bearer '+hostRoom.mediaToken,'content-type':'audio/wav','x-audio-title':'Station sample'},body:bytes});
 assert.equal(upload.status,201);
 const track=await upload.json();
 assert.equal(track.ok,true);
 const state=await updateListener;
 assert.equal(state.room.queue.find(x=>x.id===track.trackId)?.title,'Station sample');
 assert.equal(state.room.queue.find(x=>x.id===track.trackId)?.kind,'station-file');
 assert.equal(JSON.stringify(state).includes(listenerRoom.mediaToken),false);
 assert.equal(JSON.stringify(state).includes(hostRoom.mediaToken),false);
 const streamURL=base+'/api/media/'+track.assetId;
 const denied=await fetch(streamURL);
 assert.equal(denied.status,403);
 const ok=await fetch(streamURL+'?access='+listenerRoom.mediaToken);
 assert.equal(ok.status,200);
 assert.equal(ok.headers.get('content-type'),'audio/wav');
 assert.deepEqual(Buffer.from(await ok.arrayBuffer()),bytes);
 const seek=await fetch(streamURL+'?access='+listenerRoom.mediaToken,{headers:{range:'bytes=4-11'}});
 assert.equal(seek.status,206);
 assert.equal(seek.headers.get('content-range'),'bytes 4-11/512');
 assert.deepEqual(Buffer.from(await seek.arrayBuffer()),bytes.subarray(4,12));
 const invalid=await fetch(streamURL+'?access='+listenerRoom.mediaToken,{headers:{range:'bytes=1000-'}});
 assert.equal(invalid.status,416);
 const ended=nextMessage(listener,m=>m.type==='ended');
 host.send(JSON.stringify({type:'end'}));await ended;
 const gone=await fetch(streamURL+'?access='+listenerRoom.mediaToken);
 assert.equal(gone.status,404);
});
