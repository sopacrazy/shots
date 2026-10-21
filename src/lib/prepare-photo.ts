// Resize large phone photos before upload; the backend also normalizes every image.
export async function preparePhoto(file:File):Promise<File>{
 if(file.size>25*1024*1024)throw new Error(`${file.name}: a foto deve ter até 25 MB.`);
 if(!/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)&&!['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif'].includes(file.type))throw new Error(`${file.name}: use uma foto PNG, JPEG, WebP ou AVIF.`);
 let bitmap:ImageBitmap|undefined;
 try{
  bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  const ratio=Math.min(1,2160/Math.max(bitmap.width,bitmap.height));
  if(ratio===1&&file.size<=5*1024*1024&&['image/jpeg','image/png','image/webp'].includes(file.type))return file;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const context=canvas.getContext('2d');if(!context)return file;
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
  return blob?new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg',lastModified:file.lastModified}):file;
 }catch{return file;}finally{bitmap?.close();}
}
