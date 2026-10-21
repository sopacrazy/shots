import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import http from 'node:http';
const exec=promisify(execFile);const directory=await mkdtemp(resolve(tmpdir(),'clipai-photos-'));
process.env.NODE_ENV='test';process.env.LOCAL_DATA_DIR=directory;
process.env.CLIPAI_ENV_FILE=resolve(directory,'.env');
const {default:app}=await import('../dist/index.js');
const {ffmpegPath}=await import('../dist/services/video.service.js');
const {LocalStore,filePath}=await import('../dist/services/local.service.js');
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;process.env.MEDIA_BASE_URL=base;
const request=(path,method='GET',body,headers={})=>new Promise((resolve,reject)=>{
  const req=http.request(base+path,{method,headers,agent:false},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const buffer=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,buffer,json:()=>JSON.parse(buffer.toString())});});});req.on('error',e=>{e.message=`${path}: ${e.message}`;reject(e);});if(body)req.write(body);req.end();
});
try{
  const fixture=resolve(directory,'source.mp4');
  const raw=resolve(directory,'frame.png');const wav=resolve(directory,'tone.wav');
  const crc32=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const chunk=(type,bytes)=>{const tag=Buffer.from(type);const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([tag,bytes])));return Buffer.concat([length,tag,bytes,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(320,0);header.writeUInt32BE(568,4);header[8]=8;header[9]=2;
  const pixels=Buffer.alloc((320*3+1)*568,60);for(let y=0;y<568;y++)pixels[y*(320*3+1)]=0;
  await writeFile(raw,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
  const audio=Buffer.alloc(44+44100*2);audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(44100,24);audio.writeUInt32LE(88200,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(88200,40);for(let i=0;i<44100;i++)audio.writeInt16LE(Math.round(Math.sin(i/44100*440*Math.PI*2)*5000),44+i*2);await writeFile(wav,audio);
  const created=await request('/api/photo-reels','POST',JSON.stringify({title:'Montagem de teste',images:[{fileBase64:(await readFile(raw)).toString('base64'),mimeType:'image/png'},{fileBase64:(await readFile(raw)).toString('base64'),mimeType:'image/png'}],music:{fileBase64:(await readFile(wav)).toString('base64'),mimeType:'audio/wav'},seconds_per_image:2,transition:'slide',fit:'contain',music_volume:.4,caption:'Produto de teste. #cozinha',watermark:'@loja'}),{'Content-Type':'application/json'});
  console.log('Edit:',created.status);assert.equal(created.status,202);const edit=created.json();let job;
  for(let i=0;i<360;i++){job=(await request(`/api/edits/${edit.id}`)).json();if(i%10===0)console.log('Status:',job.status);if(['ready','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,500));}
  assert.equal(job.status,'ready',job.error??'Edição não terminou');
  console.log('Output ready:',job.output_url);const video=await request(job.output_url,'GET',undefined,{Range:'bytes=0-1023'});assert.equal(video.status,206);assert.equal(video.buffer.length,1024);
  const probe=await exec(ffmpegPath('ffprobe'),['-v','error','-show_entries','stream=codec_type,width,height','-of','json',filePath('videos',`edits/${edit.id}.mp4`)]);
  const streams=JSON.parse(probe.stdout).streams;assert.ok(streams.some(s=>s.codec_type==='audio'));assert.ok(streams.some(s=>s.codec_type==='video'&&s.width===1080&&s.height===1920));
  const saved=await new LocalStore(directory).read();assert.equal(saved.edits[0].caption,'Produto de teste. #cozinha');assert.equal(saved.edits[0].status,'ready');
  assert.equal((await request('/api/instagram/publish/'+edit.id,'POST')).status,400);
  assert.equal(saved.edits[0].photo_reel.images.length,2);
  const duration=await exec(ffmpegPath('ffprobe'),['-v','error','-show_entries','format=duration','-of','json',filePath('videos',`edits/${edit.id}.mp4`)]);
  assert.ok(Math.abs(Number(JSON.parse(duration.stdout).format.duration)-3.4)<.15);
  console.log('Reel com fotos OK: duas imagens, zoom/transição, música repetida, MP4 1080x1920 de 3,4s com áudio, download e persistência.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
