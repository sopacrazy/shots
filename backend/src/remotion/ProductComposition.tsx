import React from 'react';
import {AbsoluteFill,OffthreadVideo,Img} from 'remotion';
export interface ProductProps extends Record<string,unknown> { videoUrl:string;durationSeconds:number;watermark:string;position:string;logoUrl:string|null; }
export const ProductComposition:React.FC<ProductProps>=({videoUrl,watermark,position,logoUrl})=>{
  const placement:React.CSSProperties={position:'absolute',...(position.startsWith('top')?{top:100}:{bottom:250}),...(position.endsWith('right')?{right:64}:{left:64})};
  return <AbsoluteFill style={{backgroundColor:'black'}}>
    <OffthreadVideo src={videoUrl} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
    {watermark&&<div style={{...placement,color:'rgba(255,255,255,.8)',fontFamily:'Arial,sans-serif',fontSize:40,fontWeight:600,textShadow:'2px 2px 4px rgba(0,0,0,.7)',maxWidth:900,whiteSpace:'pre-wrap',overflowWrap:'anywhere',...(logoUrl?(position.startsWith('top')?{top:310}:{bottom:450}):{})}}>{watermark}</div>}
    {logoUrl&&<Img src={logoUrl} style={{...placement,width:180,maxHeight:180,objectFit:'contain'}}/>}
  </AbsoluteFill>;
};
