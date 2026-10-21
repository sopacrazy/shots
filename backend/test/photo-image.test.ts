import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {normalizePhotoImage,validatePhotoFile} from '../src/services/photo-image.service.js';

test('converte foto de 45 megapixels acima de 8192 pixels, preservando proporção',async()=>{
 const original=await sharp({create:{width:9000,height:5000,channels:3,background:'#c87632'}}).jpeg().toBuffer();
 const result=await normalizePhotoImage(original,0),metadata=await sharp(result).metadata();
 assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,2160);assert.equal(metadata.height,1200);
 assert.ok(result.length<original.length);
});
test('corrige orientação EXIF e lê WebP sem depender do FFprobe',async()=>{
 const original=await sharp({create:{width:100,height:200,channels:3,background:'blue'}}).jpeg().withMetadata({orientation:6}).toBuffer();
 const rotated=await sharp(await normalizePhotoImage(original,0)).metadata();assert.equal(rotated.width,200);assert.equal(rotated.height,100);assert.equal(rotated.orientation,undefined);
 const webp=await sharp({create:{width:80,height:120,channels:4,background:'#ffffff00'}}).webp().toBuffer();
 const normalized=await sharp(await normalizePhotoImage(webp,1)).metadata();assert.equal(normalized.format,'jpeg');assert.equal(normalized.width,80);assert.equal(normalized.hasAlpha,false);
});
test('arquivo corrompido identifica qual foto falhou; não aceita SVG e base64 inválido',async()=>{
 await assert.rejects(normalizePhotoImage(Buffer.from('foto danificada'),2),/converter a foto 3/);
 for(const fileBase64 of ['%%%%',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')])assert.throws(()=>validatePhotoFile({fileBase64}),e=>(e as {status:number}).status===400);
});
