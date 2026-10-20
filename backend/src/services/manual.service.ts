import type { RequestHandler } from 'express';
import { store, projectIn, saveFile } from './local.service.js';

export const route = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve().then(() => fn(req, res, next)).catch(next);
};
export function text(value: unknown, name: string, max = 20000): string {
  if (typeof value !== 'string' || value.length > max) throw Object.assign(new Error(`${name} inválido`), { status: 400 });
  return value.trim();
}
export function validateScript(body: Record<string, unknown>) {
  const title = text(body.title, 'Título', 200);
  const hook = text(body.hook ?? '', 'Gancho');
  const content = text(body.body, 'Roteiro');
  const cta = text(body.cta ?? '', 'CTA');
  if (!title || !content) throw Object.assign(new Error('Título e roteiro são obrigatórios'), { status: 400 });
  if (!Array.isArray(body.scenes) || !body.scenes.length || body.scenes.length > 50) {
    throw Object.assign(new Error('Informe de 1 a 50 cenas'), { status: 400 });
  }
  const scenes = body.scenes.map((s: Record<string, unknown>, i: number) => {
    if (!s || typeof s !== 'object') throw Object.assign(new Error('Cena inválida'), { status: 400 });
    const duration = Number(s.duration_seconds);
    const description = text(s.description, 'Texto da cena');
    if (!description || !Number.isInteger(duration) || duration < 1 || duration > 300) {
      throw Object.assign(new Error('Cada cena precisa de texto e duração de 1 a 300 segundos'), { status: 400 });
    }
    return { scene_number: i + 1, description, duration_seconds: duration };
  });
  if (scenes.reduce((sum, s) => sum + s.duration_seconds, 0) > 1800) {
    throw Object.assign(new Error('Duração máxima: 30 minutos'), { status: 400 });
  }
  return { title, hook, body: content, cta, scenes,
    description: text(body.description ?? '', 'Descrição'),
    hashtags: text(body.hashtags ?? '', 'Hashtags', 2000).split(/[,\s]+/).map(t => t.replace(/^#/, '')).filter(Boolean),
  };
}
const TYPES: Record<string, { ext: string; signature: (b: Buffer) => boolean }> = {
  'image/png': { ext: 'png', signature: b => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  'image/jpeg': { ext: 'jpg', signature: b => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  'image/webp': { ext: 'webp', signature: b => b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' },
  'audio/mpeg': { ext: 'mp3', signature: b => b.toString('ascii',0,3) === 'ID3' || (b[0] === 255 && (b[1] & 224) === 224) },
  'audio/wav': { ext: 'wav', signature: b => b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WAVE' },
};
export function validateUpload(body: Record<string, unknown>, kind: 'image' | 'audio') {
  const mime = body.mimeType;
  if (typeof mime !== 'string' || !mime.startsWith(`${kind}/`) || !TYPES[mime]) {
    throw Object.assign(new Error(kind === 'image' ? 'Use PNG, JPEG ou WebP' : 'Use MP3 ou WAV'), { status: 400 });
  }
  const base64 = body.fileBase64 ?? body.imageBase64;
  if (typeof base64 !== 'string' || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw Object.assign(new Error('Arquivo base64 inválido'), { status: 400 });
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 25 * 1024 * 1024 || !TYPES[mime].signature(buffer)) {
    throw Object.assign(new Error('Arquivo inválido ou maior que 25 MB'), { status: 400 });
  }
  return { buffer, mime, ext: TYPES[mime].ext };
}
export async function editableProject(id: string) { return projectIn(await store.read(), id, true); }
export async function upload(projectId: string, body: Record<string, unknown>, kind: 'image' | 'audio', prefix: string) {
  const { buffer, ext } = validateUpload(body, kind);
  return saveFile('audio', `manual/${projectId}/${prefix}-${crypto.randomUUID()}.${ext}`, buffer);
}
