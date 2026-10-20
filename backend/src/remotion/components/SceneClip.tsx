import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface SceneClipProps {
  imageUrl: string;
  sceneIndex?: number;
}

// 8 padrões de movimento — varia por índice de cena
const MOVEMENTS = [
  // 0: Zoom in centro — dramático
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.05, 1.3], { extrapolateRight: 'clamp' }),
    x: 0, y: 0,
  }),
  // 1: Pan esquerda→direita + zoom leve
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.15, 1.2], { extrapolateRight: 'clamp' }),
    x: interpolate(f, [0, total], [-4, 4], { extrapolateRight: 'clamp' }),
    y: 0,
  }),
  // 2: Pan direita→esquerda + zoom
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.15, 1.2], { extrapolateRight: 'clamp' }),
    x: interpolate(f, [0, total], [4, -4], { extrapolateRight: 'clamp' }),
    y: 0,
  }),
  // 3: Zoom out + pan baixo→cima
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.3, 1.05], { extrapolateRight: 'clamp' }),
    x: 0,
    y: interpolate(f, [0, total], [3, -3], { extrapolateRight: 'clamp' }),
  }),
  // 4: Pan diagonal — canto sup-esq → inf-dir
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.1, 1.25], { extrapolateRight: 'clamp' }),
    x: interpolate(f, [0, total], [-3, 3], { extrapolateRight: 'clamp' }),
    y: interpolate(f, [0, total], [-3, 3], { extrapolateRight: 'clamp' }),
  }),
  // 5: Pan diagonal inversa — inf-dir → canto sup-esq
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.2, 1.1], { extrapolateRight: 'clamp' }),
    x: interpolate(f, [0, total], [3, -3], { extrapolateRight: 'clamp' }),
    y: interpolate(f, [0, total], [3, -3], { extrapolateRight: 'clamp' }),
  }),
  // 6: Zoom in brusco top-center
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.0, 1.35], { extrapolateRight: 'clamp' }),
    x: 0,
    y: interpolate(f, [0, total], [0, -4], { extrapolateRight: 'clamp' }),
  }),
  // 7: Zoom out + pan suave direita
  (f: number, total: number) => ({
    scale: interpolate(f, [0, total], [1.35, 1.05], { extrapolateRight: 'clamp' }),
    x: interpolate(f, [0, total], [0, 5], { extrapolateRight: 'clamp' }),
    y: 0,
  }),
] as const;

export const SceneClip: React.FC<SceneClipProps> = ({ imageUrl, sceneIndex = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const pattern = MOVEMENTS[sceneIndex % MOVEMENTS.length];
  const { scale, x, y } = pattern(frame, durationInFrames);

  // Fade in rápido (3 frames) para não sumir antes do áudio iniciar; sem fade out (próxima cena sobrepõe)
  const opacity = interpolate(
    frame,
    [0, 3],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          transformOrigin: 'center center',
        }}
      >
        <Img
          src={imageUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
