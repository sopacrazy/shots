import { mkdir, readFile, writeFile, rename, unlink, rm } from 'node:fs/promises';
import { resolve, dirname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Project, Script, Scene, Narration, ExportMetadata, Folder, ProjectStatus } from '../types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export function dataDirectory() { return resolve(root, process.env.LOCAL_DATA_DIR || 'data'); }
export interface Database {
  shopee_favorites?: import('./shopee.service.js').ShopeeProduct[];
  brand?: {watermark:string;watermark_position:string;logo_url:string|null};
  version: 1; projects: Project[]; folders: Folder[]; scripts: Script[];
  scenes: Scene[]; narrations: Narration[]; export_metadata: ExportMetadata[]; edits: VideoEdit[]; comment_replies: CommentReply[];
}
function empty(): Database { return { version: 1, projects: [], folders: [], scripts: [], scenes: [], narrations: [], export_metadata: [], edits: [], comment_replies: [] }; }
export function row() { return { id: randomUUID(), created_at: new Date().toISOString() }; }
export function problem(message: string, status = 400): Error { return Object.assign(new Error(message), { status }); }
export function projectIn(db: Database, id: string, editable = false) {
  const project = db.projects.find(p => p.id === id);
  if (!project) throw problem('Projeto não encontrado', 404);
  if (editable && project.status === 'rendering') throw problem('Aguarde a renderização terminar', 409);
  return project;
}
export function invalidate(db: Database, id: string, status: ProjectStatus) {
  const project = projectIn(db, id);
  project.status = status; project.updated_at = new Date().toISOString();
  const metadata = db.export_metadata.find(m => m.project_id === id);
  if (metadata) metadata.video_url = null;
}

// Escritas serializadas e substituição atômica: nenhum leitor vê JSON parcial.
// Uma instância do backend deve ser executada por diretório de dados.
export class LocalStore {
  private state?: Database;
  private ready?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly directoryOverride?: string) {}
  get directory() { return this.directoryOverride ?? dataDirectory(); }
  private async persist(db: Database) {
    const target = resolve(this.directory, 'database.json');
    const temp = `${target}.${randomUUID()}.tmp`;
    try { await writeFile(temp, JSON.stringify(db, null, 2), { flag: 'wx' }); await rename(temp, target); }
    finally { await unlink(temp).catch(() => {}); }
  }
  private init() {
    if (!this.ready) this.ready = (async () => {
      await mkdir(this.directory, { recursive: true });
      let db: Database;
      try {
        db = JSON.parse(await readFile(resolve(this.directory, 'database.json'), 'utf8'));
        if (db.version !== 1 || !['projects','folders','scripts','scenes','narrations','export_metadata'].every(k => Array.isArray((db as unknown as Record<string,unknown>)[k]))) {
          throw new Error('Formato do banco local inválido. Restaure um backup de database.json.');
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        db = empty(); await this.persist(db);
      }
      db.edits ??= [];
      db.comment_replies ??= [];
      for (const reply of db.comment_replies) {
        if (reply.public_state === 'sending') { reply.public_state = 'unknown'; if(reply.private_state==='pending')reply.private_state='cancelled'; reply.error = 'Resposta pública interrompida. Confira o comentário antes de reenviar.'; }
        if (reply.private_state === 'sending') { reply.private_state = 'unknown'; reply.error = 'Envio ao Direct interrompido. Confira a conversa antes de reenviar.'; }
      }
      let recovered = db.comment_replies.some(r => r.public_state === 'unknown' || r.private_state === 'unknown');
      for (const edit of db.edits) {
        if (edit.status === 'processing' || edit.status === 'queued') { edit.status = 'error'; edit.error = 'Edição interrompida. Gere uma nova versão.'; recovered = true; }
        if (edit.publish_state === 'processing') { edit.publish_state = edit.publish_attempted_at ? 'unknown' : 'error'; edit.publish_error = 'Publicação interrompida. Confira sua conta antes de tentar novamente.'; recovered = true; }
      }
      for (const project of db.projects) if (project.status === 'rendering') {
        project.status = 'error'; project.updated_at = new Date().toISOString(); recovered = true;
      }
      if (recovered) await this.persist(db);
      this.state = db;
    })();
    return this.ready;
  }
  async read(): Promise<Database> { await this.init(); await this.tail; return structuredClone(this.state!); }
  change<T>(fn: (db: Database) => T): Promise<T> {
    const operation = this.tail.then(async () => {
      await this.init();
      const next = structuredClone(this.state!);
      const result = fn(next);
      await this.persist(next); this.state = next;
      return structuredClone(result);
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
export const store = new LocalStore();

export function filePath(bucket: string, name: string) {
  if (!['audio','videos','library'].includes(bucket) || !name || name.includes('\\') || name.split('/').some(s => !s || s === '.' || s === '..') || isAbsolute(name)) {
    throw problem('Caminho de arquivo inválido');
  }
  const base = bucket === 'library' ? resolve(dataDirectory(), 'library') : resolve(dataDirectory(), 'files', bucket);
  const target = resolve(base, name);
  if (!target.startsWith(base + sep)) throw problem('Caminho de arquivo inválido');
  return target;
}
export function fileUrl(bucket: string, name: string) { filePath(bucket, name); return `/api/files/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`; }
export function mediaUrl(url: string) {
  if (!url.startsWith('/api/files/')) return url;
  return new URL(url, process.env.MEDIA_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).href;
}
export function localMediaPath(url: string) {
  if (!url.startsWith('/api/files/')) return url;
  const [bucket, ...segments] = url.slice('/api/files/'.length).split('/').map(decodeURIComponent);
  return filePath(bucket, segments.join('/'));
}
export async function saveFile(bucket: string, name: string, contents: Buffer) {
  const target = filePath(bucket, name);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, contents); await rename(temporary, target); }
  finally { await unlink(temporary).catch(() => {}); }
  return fileUrl(bucket, name);
}
export async function removeProjectFiles(id: string) {
  // UUID de projeto validado antes de calcular qualquer alvo de remoção.
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw problem('ID inválido');
  const directory = filePath('audio', `manual/${id}`);
  const video = filePath('videos', `videos/${id}.mp4`);
  await rm(directory, { recursive: true, force: true });
  await unlink(video).catch(e => { if (e.code !== 'ENOENT') throw e; });
}

export interface VideoEdit {
  id: string; created_at: string; source_id: string; source_name: string; category: string;
  caption: string; affiliate_url?: string | null; watermark: string; watermark_position: 'top-left'|'top-right'|'bottom-left'|'bottom-right';
  logo_url: string | null; output_url: string | null; status: 'queued'|'processing'|'ready'|'error'; error: string | null;
  publish_state: 'idle'|'processing'|'published'|'error'|'unknown'; publish_error?: string;
  instagram_container_id?: string; instagram_media_id?: string; instagram_permalink?: string;
  instagram_account_id?: string; auto_dm_enabled?: boolean;
  publish_attempted_at?: string;
  published_at?: string;
  media_deleted_at?: string;
  hidden_at?: string;
  source_deleted_at?: string;
}

export type ReplyState = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'cancelled';
export interface CommentReply {
  id: string; account_id: string; comment_id: string; media_id: string; edit_id: string;
  username: string | null; product: string; affiliate_url: string;
  public_text: string; private_text: string;
  public_state: ReplyState; private_state: ReplyState;
  public_reply_id?: string; private_message_id?: string;
  created_at: string; updated_at: string; error?: string;
}
