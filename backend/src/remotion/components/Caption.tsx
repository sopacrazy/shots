import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface CaptionProps {
  text: string;
  durationInFrames: number;
}

export const Caption: React.FC<CaptionProps> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrada suave — spring menos agressivo
  const translateY = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 160, mass: 0.8 },
    from: 24,
    to: 0,
    durationInFrames: 14,
  });

  // Fade in suave nos primeiros 10 frames, fade out nos últimos 8
  const opacity = interpolate(
    frame,
    [0, durationInFrames * 0.2, durationInFrames * 0.8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const words = text.split(' ');
  const activeIndex = Math.min(
    Math.floor((frame / Math.max(durationInFrames, 1)) * words.length),
    words.length - 1
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 360,
        paddingLeft: 40,
        paddingRight: 40,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        style={{
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '88%',
        }}
      >
        {words.map((word, i) => {
          const isActive = i === activeIndex;
          const isSpoken = i < activeIndex;

          // Palavra ativa: branca com fundo amarelo sutil ou amarela clara
          // Faladas: cinza claro
          // Futuras: branco 40% opacidade
          const color = isActive ? '#FFE600' : isSpoken ? '#E0E0E0' : '#FFFFFF';
          const textShadow = isActive
            ? '0 0 16px rgba(255,230,0,0.6), 0 2px 8px rgba(0,0,0,1)'
            : '0 2px 8px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9)';
          const scale = isActive ? 1.08 : 1;
          const wordOpacity = isActive ? 1 : isSpoken ? 0.7 : 0.45;

          return (
            <span
              key={i}
              style={{
                fontFamily: '"Outfit", "Arial Black", sans-serif',
                fontWeight: 900,
                fontSize: 64,
                textTransform: 'uppercase',
                fontStyle: 'italic',
                letterSpacing: '-0.5px',
                color,
                WebkitTextStroke: '1.5px rgba(0,0,0,0.9)',
                textShadow,
                marginRight: 10,
                display: 'inline-block',
                transform: `scale(${scale})`,
                transformOrigin: 'center bottom',
                opacity: wordOpacity,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
