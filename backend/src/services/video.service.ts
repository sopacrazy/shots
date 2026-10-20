import {selectComposition,renderMedia} from '@remotion/renderer';
import {getBundle,detectChrome} from '../workers/render.worker.js';
import { readdir, mkdir, writeFile, copyFile, readFile, unlink } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PQueue from 'p-queue';
import { dataDirectory, filePath, fileUrl, localMediaPath, store, problem, mediaUrl, type VideoEdit } from './local.service.js';
const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
export function ffmpegPath(tool: 'ffmpeg' | 'ffprobe' = 'ffmpeg') {
  if (tool === 'ffmpeg' && process.env.FFMPEG_EXECUTABLE) return process.env.FFMPEG_EXECUTABLE;
  for (const base of ['../../../node_modules', '../../../../node_modules']) {
    const linux = resolve(here,base,`@remotion/compositor-linux-x64-gnu/${tool}`);
    if(process.platform==='linux'&&existsSync(linux))return linux;
    const path = resolve(here, base, `@remotion/compositor-win32-x64-msvc/${tool}.exe`);
    if (existsSync(path)) return path;
  }
  return tool;
}
export interface LibraryVideo { id: string; name: string; category: string; url: string; relative_path: string; size: number; }
export async function listVideos(): Promise<LibraryVideo[]> {
  const base = resolve(dataDirectory(),'library'); await mkdir(base,{ recursive:true });
  const result: LibraryVideo[] = [];
  const walk = async (folder: string, prefix = '') => {
    for (const entry of await readdir(folder,{ withFileTypes:true })) {
      if (entry.isSymbolicLink()) continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(resolve(folder,entry.name),name);
      else if (entry.isFile() && /\.(mp4|mov|webm|m4v)$/i.test(entry.name)) {
        const { stat } = await import('node:fs/promises');
        const info = await stat(filePath('library',name));
        result.push({ id: createHash('sha256').update(name).digest('hex'), name: entry.name, category: prefix || 'Sem categoria', url: fileUrl('library',name), relative_path: name, size: info.size });
      }
    }
  };
  await walk(base); return result.sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
export function safeName(value: string) { return value.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,120); }
export async function importVideo(category: string, name: string, buffer: Buffer) {
  if (!/\.(mp4|mov|webm|m4v)$/i.test(name) || !buffer.length) throw problem('Use MP4, MOV ou WebM');
  const folder = category.split('/').filter(Boolean).map(safeName).filter(s => s && s !== '.' && s !== '..').join('/') || 'Sem categoria';
  const filename = `${randomUUID().slice(0,8)}-${safeName(name)}`;
  const relative = `${folder}/${filename}`;
  const target = filePath('library',relative); await mkdir(dirname(target),{recursive:true});
  await writeFile(target,buffer,{flag:'wx'});
  try {
    const { stdout } = await exec(ffmpegPath('ffprobe'),['-v','error','-select_streams','v:0','-show_entries','stream=codec_type','-of','json',target],{timeout:30000});
    if (!JSON.parse(stdout).streams?.some((s: {codec_type:string}) => s.codec_type === 'video')) throw problem('O arquivo não contém vídeo');
  } catch {
    await unlink(target).catch(() => {}); throw problem('Arquivo de vídeo inválido ou FFprobe indisponível');
  }
  return (await listVideos()).find(v => v.relative_path === relative)!;
}
const queue = new PQueue({concurrency:1});
export function enqueueEdit(editId: string) {
  void queue.add(async () => {
    try { await renderProductEdit(editId); }
    catch(e) { await store.change(db => { const job=db.edits.find(j=>j.id===editId); if(job) {job.status='error';job.error=e instanceof Error?e.message:'Erro na edição';} }); }
  }).catch(e => console.error('Falha na fila de edição:', e.message));
}
export async function renderProductEdit(id: string) {
  const edit = await store.change(db => { const job=db.edits.find(e=>e.id===id); if(!job) throw problem('Edição não encontrada',404); job.status='processing';return job; });
  const source = (await listVideos()).find(v=>v.id===edit.source_id); if(!source) throw problem('Vídeo original não encontrado');
  const output = filePath('videos',`edits/${id}.mp4`); await mkdir(dirname(output),{recursive:true});
  const {stdout}=await exec(ffmpegPath('ffprobe'),['-v','error','-show_entries','format=duration','-of','json',filePath('library',source.relative_path)],{timeout:30000});
  const duration=Number(JSON.parse(stdout).format?.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>1800)throw problem('Use vídeos de até 30 minutos');
  const browserExecutable=detectChrome();if(!browserExecutable)throw new Error('Instale Google Chrome para editar vídeos');
  const serveUrl=await getBundle();
  const inputProps={videoUrl:mediaUrl(source.url),durationSeconds:duration,watermark:edit.watermark,position:edit.watermark_position,logoUrl:edit.logo_url?mediaUrl(edit.logo_url):null};
  const composition=await selectComposition({serveUrl,id:'ProductVideo',inputProps,browserExecutable});
  await renderMedia({serveUrl,composition,inputProps,browserExecutable,codec:'h264',outputLocation:output,videoBitrate:'6M',audioCodec:'aac',concurrency:2,timeoutInMilliseconds:120000});
  await store.change(db=>{const job=db.edits.find(e=>e.id===id)!;job.status='ready';job.error=null;job.output_url=fileUrl('videos',`edits/${id}.mp4`);});
}
export function newEdit(source: LibraryVideo, caption: string, watermark: string, position: VideoEdit['watermark_position'], logo_url: string | null, affiliate_url: string | null = null): VideoEdit {
  return { id:randomUUID(),created_at:new Date().toISOString(),source_id:source.id,source_name:source.name,category:source.category,caption,affiliate_url,watermark,watermark_position:position,logo_url,output_url:null,status:'queued',error:null,publish_state:'idle' };
}
