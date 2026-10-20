import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { store, projectIn, mediaUrl, localMediaPath, saveFile, problem } from '../services/local.service.js';
import type { SceneData } from '../remotion/VideoComposition.js';

const execAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache do bundle para não rebuildar a cada renderização
let _bundleUrl: string | null = null;

export async function getBundle(): Promise<string> {
  if (_bundleUrl) return _bundleUrl;

  console.log('[Render] Criando bundle Remotion (primeira vez ~30s)...');
  const entryPoint = resolve(__dirname, existsSync(resolve(__dirname, '../remotion/index.ts')) ? '../remotion/index.ts' : '../remotion/index.js');

  _bundleUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => {
      config.module = { ...config.module, rules: [...(config.module?.rules ?? []), { test: /\.m?js$/, resolve: { fullySpecified: false } }] };
      return config;
    },
  });

  console.log('[Render] Bundle criado:', _bundleUrl);
  return _bundleUrl;
}

function detectFfmpeg(): string {
  // Usa o ffmpeg que o próprio Remotion já tem instalado
  const remotionFf = resolve(__dirname, '../../../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
  if (existsSync(remotionFf)) return remotionFf;

  const hoistedFf = resolve(__dirname, '../../../../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
  if (existsSync(hoistedFf)) return hoistedFf;

  // Linux / macOS
  const unix = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  const found = unix.find(existsSync);
  if (found) return found;

  return 'ffmpeg'; // fallback ao PATH
}

// Mede duração real do áudio via ffmpeg stderr (funciona com URLs HTTP)
async function getAudioDuration(audioUrl: string, ffmpegBin: string): Promise<number | null> {
  try {
    // ffmpeg -i sem output sai com código 1, mas imprime duração no stderr
    const result = await execAsync(ffmpegBin, ['-i', audioUrl], { timeout: 30000 })
      .catch((e: { stderr?: string }) => e);
    const output = (result as { stderr?: string }).stderr ?? '';
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (!match) return null;
    const seconds = +match[1] * 3600 + +match[2] * 60 + +match[3];
    return seconds > 0.5 ? seconds : null;
  } catch {
    return null;
  }
}

export function detectChrome(): string | undefined {
  if (process.env.CHROME_EXECUTABLE) return process.env.CHROME_EXECUTABLE;

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  return candidates.find(existsSync);
}

export async function renderVideo(
  projectId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const db = await store.read();
  projectIn(db,projectId);
  const script = db.scripts.find(s => s.project_id === projectId);
  const scenes = db.scenes.filter(s => s.project_id === projectId).sort((a,b) => a.scene_number-b.scene_number);
  if (!script) throw problem('Salve o roteiro primeiro');
  if (!scenes.length || scenes.some(s => !s.image_url)) throw problem('Adicione uma imagem a cada cena');
  const narration = db.narrations.filter(n => n.project_id === projectId).at(-1);
  const audioUrl = narration ? mediaUrl(narration.audio_url) : null;
  const endCard = db.export_metadata.find(m => m.project_id === projectId)?.end_card_url;
  const endCardUrl = endCard ? mediaUrl(endCard) : null;

  // Mede duração real do áudio para sincronizar as cenas
  const ffmpegBin = detectFfmpeg();
  let audioDuration = script.duration_seconds as number;
  if (audioUrl) {
    const measured = await getAudioDuration(narration ? localMediaPath(narration.audio_url) : audioUrl, ffmpegBin);
    if (measured) {
      audioDuration = measured;
      console.log(`[Render] Duração real do áudio: ${measured.toFixed(2)}s (definido no roteiro: ${script.duration_seconds}s)`);
    }
  }

  // Redistribui duração das cenas proporcionalmente à duração real do áudio
  const totalGptDuration = scenes.reduce((sum: number, s: { duration_seconds: number }) => sum + s.duration_seconds, 0);
  const sceneData: SceneData[] = scenes.map((s) => ({
    imageUrl: mediaUrl(s.image_url!),
    description: s.description,
    durationSeconds: (s.duration_seconds / totalGptDuration) * audioDuration,
  }));

  // Quebra o roteiro em linhas curtas para as legendas (usa duração real do áudio)
  const scriptLines = buildCaptionLines(
    `${script.hook} ${script.body} ${script.cta}`,
    audioDuration
  );

  // 3. Bundle + render
  const serveUrl = await getBundle();

  const fps = 30;
  const END_CARD_SECONDS = endCardUrl ? 5 : 0;
  const durationInFrames = Math.round((audioDuration + END_CARD_SECONDS) * fps);
  const outputPath = resolve(tmpdir(), `astrashorts-${projectId}.mp4`);

  console.log(`[Render] Renderizando ${audioDuration.toFixed(1)}s @ ${fps}fps → ${outputPath}`);

  const browserExecutable = detectChrome();
  if (!browserExecutable) {
    throw new Error(
      'Chrome não encontrado. Instale o Google Chrome ou defina CHROME_EXECUTABLE no .env'
    );
  }

  const composition = await selectComposition({
    serveUrl,
    id: 'AstraShort',
    inputProps: {
      scenes: sceneData,
      scriptLines,
      audioUrl,
      durationSeconds: audioDuration,
      endCardUrl,
    },
    puppeteerInstance: undefined,
    browserExecutable,
  });

  // Usa duração calculada do áudio real — calculateMetadata em Root.tsx garante que composition.durationInFrames já está correto
  const actualDuration = durationInFrames;

  await renderMedia({
    composition: { ...composition, durationInFrames: actualDuration },
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    browserExecutable,
    inputProps: {
      scenes: sceneData,
      scriptLines,
      audioUrl,
      durationSeconds: audioDuration,
      endCardUrl,
    },
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 5 === 0) {
        console.log(`[Render] ${pct}% concluído`);
        onProgress?.(pct);
      }
    },
    videoBitrate: '4M',         // ~30MB por minuto — bom para web
    encodingMaxRate: '6M',      // limita picos para streaming suave
    encodingBufferSize: '8M',
    chromiumOptions: {
      disableWebSecurity: true, // necessário para carregar imagens de URLs externas
    },
    timeoutInMilliseconds: 10 * 60 * 1000, // 10 minutos
  });

  console.log('[Render] Renderização concluída. Aplicando faststart...');

  // 4. Aplica -movflags +faststart: move o moov atom para o início do arquivo
  // Isso permite que o browser comece a reproduzir sem baixar o vídeo inteiro
  const faststartPath = outputPath.replace('.mp4', '-web.mp4');
  try {
    await execAsync(ffmpegBin, ['-y', '-i', outputPath, '-c', 'copy', '-movflags', '+faststart', faststartPath], { timeout: 120000 });
    await unlink(outputPath).catch(() => {});
    console.log('[Render] Faststart aplicado com sucesso');
  } catch (e) {
    console.warn('[Render] Faststart falhou, copiando original:', (e as Error).message);
    const { copyFile } = await import('fs/promises');
    await copyFile(outputPath, faststartPath);
    await unlink(outputPath).catch(() => {});
  }

  const videoUrl = await saveFile('videos', `videos/${projectId}.mp4`, await readFile(faststartPath));
  await unlink(faststartPath).catch(() => {});
  await store.change(db => {
    const project = projectIn(db,projectId);
    const metadata = db.export_metadata.find(m => m.project_id === projectId);
    if (!metadata) throw new Error('Metadados não encontrados');
    metadata.video_url = videoUrl; project.status = 'completed'; project.updated_at = new Date().toISOString();
  });

  console.log(`[Render] ✅ Vídeo disponível em: ${videoUrl}`);
  return videoUrl;
}

// Divide o roteiro em frases curtas para as legendas (máx 5 palavras por linha)
function buildCaptionLines(text: string, durationSeconds: number): string[] {
  const WORDS_PER_LINE = 4;
  const words = text
    .replace(/["""]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const lines: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '));
  }

  // Garante pelo menos 1 linha por segundo de vídeo
  const maxLines = Math.floor(durationSeconds * 1.5);
  return lines.slice(0, maxLines);
}
