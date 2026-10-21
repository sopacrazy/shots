import React from 'react';
import {PhotoReelComposition} from './PhotoReelComposition';
import { ProductComposition } from './ProductComposition';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import type { VideoCompositionProps } from './VideoComposition';

const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 45; // segundos

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition id="PhotoReel" component={PhotoReelComposition} width={1080} height={1920} fps={30} durationInFrames={90}
      defaultProps={{images:[] as string[],musicUrl:null as string|null,musicFrames:30,secondsPerImage:3,transition:'fade',musicVolume:.45,fit:'contain' as 'contain'|'cover',watermark:'',position:'top-right',logoUrl:null as string|null}}
      calculateMetadata={({props})=>({durationInFrames:Math.max(1,props.images.length*Math.round(props.secondsPerImage*30)-Math.max(0,props.images.length-1)*18)})}/>
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
