import React from 'react';
import { ProductComposition } from './ProductComposition';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import type { VideoCompositionProps } from './VideoComposition';

const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 45; // segundos

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="AstraShort"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={VideoComposition as React.ComponentType<any>}
      durationInFrames={DEFAULT_DURATION * DEFAULT_FPS}
      fps={DEFAULT_FPS}
      width={1080}
      height={1920}
      defaultProps={{
        scenes: [],
        scriptLines: [],
        audioUrl: null,
        durationSeconds: DEFAULT_DURATION,
        endCardUrl: null,
      } satisfies VideoCompositionProps}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      calculateMetadata={({ props }: any) => ({
        durationInFrames: Math.round(
          ((props as VideoCompositionProps).durationSeconds + ((props as VideoCompositionProps).endCardUrl ? 5 : 0)) * DEFAULT_FPS
        ),
      })}
    />
    <Composition id="ProductVideo" component={ProductComposition} width={1080} height={1920} fps={30} durationInFrames={30}
      defaultProps={{videoUrl:'',durationSeconds:1,watermark:'',position:'top-right',logoUrl:null}}
      calculateMetadata={({props})=>({durationInFrames:Math.max(1,Math.round(props.durationSeconds*30))})}/>
    </>
  );
};
