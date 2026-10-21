import React from 'react';
import {AbsoluteFill,Audio,Img,Loop,Sequence,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
export interface PhotoReelProps extends Record<string,unknown> {images:string[];musicUrl:string|null;musicFrames:number;secondsPerImage:number;transition:string;musicVolume:number;fit:'contain'|'cover';watermark:string;position:string;logoUrl:string|null;}
const Photo:React.FC<{src:string;index:number;frames:number;transition:string;fit:'contain'|'cover'}>=({src,index,frames,transition,fit})=>{
  const frame=useCurrentFrame();const blend=18;
  const progress=Math.min(1,Math.max(0,frame/(frames-1)));
  const zoom=index%2===0?1+progress*.12:1.12-progress*.12;
  const entrance=index===0?1:interpolate(frame,[0,blend],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const shift=transition==='slide'?(1-entrance)*(index%2?90:-90):0;
  return <AbsoluteFill style={{opacity:entrance,transform:`translateX(${shift}px)`,overflow:'hidden',backgroundColor:'#101018'}}>
    <Img src={src} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',filter:'blur(45px) brightness(.38)',transform:'scale(1.2)'}}/>
    <Img src={src} style={{position:'absolute',width:'100%',height:'100%',objectFit:fit,transform:`scale(${zoom})`,transformOrigin:index%2?'55% 45%':'45% 55%'}}/>
  </AbsoluteFill>;
};
export const PhotoReelComposition:React.FC<PhotoReelProps>=({images,musicUrl,musicFrames,secondsPerImage,transition,musicVolume,fit,watermark,position,logoUrl})=>{
  const frame=useCurrentFrame(),{fps,durationInFrames}=useVideoConfig();const frames=Math.round(secondsPerImage*fps),blend=18,step=frames-blend;
  const placement:React.CSSProperties={position:'absolute',...(position.startsWith('top')?{top:100}:{bottom:250}),...(position.endsWith('right')?{right:64}:{left:64})};
  const volume=musicVolume*Math.min(1,frame/(fps*.5),Math.max(0,(durationInFrames-1-frame)/fps));
  return <AbsoluteFill style={{backgroundColor:'#101018'}}>
    {images.map((src,index)=><Sequence key={index} from={index*step} durationInFrames={frames}><Photo src={src} index={index} frames={frames} transition={transition} fit={fit}/></Sequence>)}
    {musicUrl&&<Loop durationInFrames={Math.max(1,musicFrames)}><Audio src={musicUrl} volume={volume}/></Loop>}
    {logoUrl&&<Img src={logoUrl} style={{...placement,width:180,maxHeight:180,objectFit:'contain'}}/>}
    {watermark&&<div style={{...placement,color:'rgba(255,255,255,.88)',fontFamily:'Arial,sans-serif',fontSize:40,fontWeight:600,textShadow:'2px 2px 4px #000',maxWidth:900,overflowWrap:'anywhere',...(logoUrl?(position.startsWith('top')?{top:310}:{bottom:450}):{})}}>{watermark}</div>}
  </AbsoluteFill>;
};
