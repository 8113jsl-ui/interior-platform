import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {uid,required,fail,now} from './security.mjs';

export function storage(config){
 const remote=!!config.supabaseURL;
 async function endpoint(id,method,body){const url=`${config.supabaseURL}/storage/v1/object/${encodeURIComponent(config.supabaseBucket)}/${id}`;const res=await fetch(url,{method,headers:{Authorization:`Bearer ${config.supabaseKey}`,...(body?{'Content-Type':'application/octet-stream','x-upsert':'false'}:{})},body,signal:AbortSignal.timeout(60000)});if(!res.ok)fail(502,'storage_unavailable');return method==='GET'?Buffer.from(await res.arrayBuffer()):null;}
 return {remote,async put(id,buffer){if(remote)await endpoint(id,'POST',buffer);else{await mkdir(join(config.dataDir,'files'),{recursive:true});await writeFile(join(config.dataDir,'files',id),buffer,{flag:'wx',mode:0o600});}},async get(id){required(/^[0-9a-f-]{36}$/.test(id),404,'not_found');return remote?endpoint(id,'GET'):readFile(join(config.dataDir,'files',id));}};
}
export async function storeFile(store,blob,context,config,driver){
 const {parent,company,project,name='',image=false,logo=false}=context;
 if(typeof blob==='string'&&/^\/api\/files\/[0-9a-f-]{36}$/.test(blob)){const f=store.get('files',blob.split('/').pop());required(f&&f.parent===parent&&f.company===company,403,'file_scope');return blob;}
 required(typeof blob==='string'&&/^data:[^;,]+;base64,[A-Za-z0-9+/=\r\n]+$/.test(blob),400,'invalid_file');
 let bytes=Buffer.from(blob.split(',')[1],'base64');required(bytes.length>0&&bytes.length<=(logo?1048576:config.maxFileBytes),413,'file_too_large');let mime,ext=name.split('.').pop().toLowerCase();
 if(image||logo){
  try{const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();required(['png','jpeg'].includes(meta.format)&&(!logo||meta.format==='png'),400,'invalid_image');bytes=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().toFormat(meta.format).toBuffer();mime=meta.format==='png'?'image/png':'image/jpeg';}catch{fail(400,'invalid_image');}
 }else if(ext==='pdf'){required(bytes.subarray(0,5).toString()==='%PDF-'&&bytes.subarray(-2048).includes(Buffer.from('%%EOF')),400,'invalid_pdf');mime='application/pdf';}
 else if(ext==='dwg'){required(/^AC10\d\d/.test(bytes.subarray(0,6).toString())&&bytes.length>64,400,'invalid_dwg');mime='application/octet-stream';}
 else if(ext==='skp'){const header=bytes.subarray(0,512);required((header.toString().includes('SketchUp Model')||header.toString('utf16le').includes('SketchUp Model'))&&bytes.length>64,400,'invalid_skp');mime='application/octet-stream';}
 else fail(400,'unsupported_file');
 const id=uid();await driver.put(id,bytes);store.put('files',{id,parent,company,project,mime,name:name||'image.png',size:bytes.length,created:now()});return '/api/files/'+id;
}
