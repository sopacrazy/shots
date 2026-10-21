import sharp from 'sharp';
import {problem} from './local.service.js';

export function validatePhotoFile(body:Record<string,unknown>){
 const base64=body.fileBase64;
 if(typeof base64!=='string'||!base64||base64.length>Math.ceil(25*1024*1024/3)*4||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw problem('Foto inválida ou maior que 25 MB');
 const buffer=Buffer.from(base64,'base64');
 const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
 const webp=buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 const heif=buffer.toString('ascii',4,8)==='ftyp'&&/^(avif|avis|heic|heix|hevc|hevx|mif1|msf1)$/.test(buffer.toString('ascii',8,12));
 if(!buffer.length||buffer.length>25*1024*1024||!png&&!jpeg&&!webp&&!heif)throw problem('Use uma foto PNG, JPEG, WebP ou AVIF');
 return {buffer};
}
export async function normalizePhotoImage(buffer:Buffer,index:number){
 try{
  const {data,info}=await sharp(buffer,{limitInputPixels:120000000,failOn:'error',pages:1})
   .autoOrient().resize({width:2160,height:2160,fit:'inside',withoutEnlargement:true})
   .flatten({background:'#ffffff'}).jpeg({quality:90}).timeout({seconds:25}).toBuffer({resolveWithObject:true});
  if(!info.width||!info.height)throw new Error('Foto sem dimensões');return data;
 }catch{
  throw problem(`Não foi possível converter a foto ${index+1}. O arquivo pode estar danificado ou em um formato não suportado. Se for HEIC/HEIF, exporte como JPEG e tente novamente.`);
 }
}
