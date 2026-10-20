import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
const browserExecutable = process.env.CHROME_EXECUTABLE || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!browserExecutable) throw new Error('Chrome não encontrado');
const webpackOverride = config => {
  config.module = { ...config.module, rules: [...(config.module?.rules ?? []), { test: /\.m?js$/, resolve: { fullySpecified: false } }] };
  return config;
};
const serveUrl = await bundle({ entryPoint: resolve('dist/remotion/index.js'), webpackOverride });
const imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1UAAAAASUVORK5CYII=';
const inputProps = { scenes: [{ imageUrl, description: 'Teste', durationSeconds: 1 }], scriptLines: ['Vídeo manual'], audioUrl: null, durationSeconds: 1, endCardUrl: null };
const composition = await selectComposition({ serveUrl, id: 'AstraShort', inputProps, browserExecutable });
const outputLocation = resolve(tmpdir(), `clipai-smoke-${Date.now()}.mp4`);
try {
  await renderMedia({ serveUrl, composition: { ...composition, width: 180, height: 320 }, codec: 'h264', inputProps, browserExecutable, outputLocation, concurrency: 1 });
  const size = (await stat(outputLocation)).size;
  if (size < 1000) throw new Error('Vídeo vazio');
  console.log(`Renderização local OK: ${composition.durationInFrames} frames, ${size} bytes`);
} finally { await unlink(outputLocation).catch(() => {}); }
