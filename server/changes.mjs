import {required,fail,uid,now,member,assignment,canProject,canItem,audit,visibleState} from './security.mjs';
import {storeFile} from './files.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields={projects:['title','site','start','end','status','phase','public','homeMessage','homeSections','archived'],clients:['title','contact','email','description','projects','archived'],items:['project','type','title','public','description','category','space','spec','quantity','price','date','time','endDate','endTime','phase','versionLabel','series','fileName','data','materialImage','previews','status','answer','corrections','archived']};
const types=['designs','materials','requests','photos','schedule','estimates'];
const homeSections=['overview','recent','schedule','resources'];
function clean(data,collection){const result={};for(const k of fields[collection])if(data[k]!==undefined)result[k]=structuredClone(data[k]);for(const [k,v]of Object.entries(result)){if(['data','materialImage'].includes(k))continue;if(typeof v==='string')required(v.length<=10000,400,'text_too_long');}required(typeof result.title==='string'&&result.title.trim().length>0&&result.title.length<=200,400,'title_required');result.title=result.title.trim();return result;}
function calendarDate(value){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return false;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];return month>=1&&month<=12&&day>=1&&day<=days[month-1];}
function dates(data){for(const k of ['start','end','date','endDate']){if(data[k]===''){delete data[k];continue;}if(data[k]!==undefined)required(typeof data[k]==='string'&&calendarDate(data[k]),400,'invalid_date');}if(data.type==='schedule')required(!!data.date,400,'invalid_date');if(data.start&&data.end)required(data.start<=data.end,400,'invalid_date');}
function schedule(data){if(data.type!=='schedule')return;for(const k of ['time','endTime']){if(data[k]===''){delete data[k];continue;}if(data[k]!==undefined)required(typeof data[k]==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data[k]),400,'invalid_time');}required(!data.endDate||data.date,400,'invalid_date');required(!data.endTime||data.time,400,'invalid_time');if(data.date&&data.endDate)required(data.date<=data.endDate,400,'invalid_date');if(data.date&&data.time&&data.endTime){const endDate=data.endDate||data.date;required(`${data.date}T${data.time}`<=`${endDate}T${data.endTime}`,400,'invalid_date');}}
export async function applyChanges(store,user,changes,config,driver){
 required(Array.isArray(changes)&&changes.length>0&&changes.length<=50,400,'invalid_changes');const seen=new Set();
 for(const change of changes){const {collection,id,baseVersion,data}=change;required(Object.hasOwn(fields,collection)&&typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&data&&typeof data==='object',400,'invalid_record');required(!seen.has(collection+id),400,'duplicate_change');seen.add(collection+id);
  const old=store.get(collection,id),raw=clean(data,collection);let company=old?.company||data.company||store.list('memberships').find(m=>m.user===user.id&&m.active)?.company;
  required(company&&member(store,user,company),403,'forbidden');
  let project;
  if(collection==='projects'){
   required(user.role==='pm'&&(!old||assignment(store,user,id)),403,'forbidden');required(['planned','active','completed'].includes(raw.status||'planned'),400,'invalid_status');raw.homeSections=raw.homeSections===undefined?[...homeSections]:raw.homeSections;required(Array.isArray(raw.homeSections)&&raw.homeSections.length<=homeSections.length&&new Set(raw.homeSections).size===raw.homeSections.length&&raw.homeSections.every(section=>homeSections.includes(section)),400,'invalid_home_sections');
  }else if(collection==='clients'){
   required(user.role==='pm',403,'forbidden');required(Array.isArray(raw.projects||[]),400,'invalid_projects');for(const pId of raw.projects||[]){const p=store.get('projects',pId);required(p?.company===company&&canProject(store,user,p),403,'forbidden');}
  }else{
   project=store.get('projects',raw.project);required(project&&project.company===company&&canProject(store,user,project),403,'forbidden');required(types.includes(raw.type),400,'invalid_type');
   if(old)required(old.project===raw.project&&old.type===raw.type&&canItem(store,user,old),403,'forbidden');
   if(user.role==='customer'){
    required(raw.type==='requests',403,'forbidden');
    if(old){required(old.uploader===user.id,403,'forbidden');for(const k of ['title','description','status','answer','public','archived'])required(equal(raw[k],old[k]),403,'immutable_request');
     const previous=old.corrections||[],next=raw.corrections||[];required(next.length===previous.length+1&&previous.every((v,i)=>equal(v,next[i])),403,'immutable_corrections');
    }else{required(!raw.answer&&!raw.archived&&!raw.corrections?.length,403,'forbidden');raw.status='open';raw.public=true;}
   }else if(user.role==='field'){
    required(raw.type==='photos'&&(!old||old.uploader===user.id),403,'forbidden');raw.public=old?.public||false;required(!raw.archived,403,'forbidden');
   }else required(user.role==='pm',403,'forbidden');
   if(raw.type==='requests'){
    if(old)required(raw.description===old.description,403,'immutable_request');raw.status=raw.status||'open';required(['open','working','resolved'].includes(raw.status),400,'invalid_status');
    const prior=old?.corrections||[],next=raw.corrections||[];required(Array.isArray(next)&&next.length>=prior.length&&next.length<=prior.length+1&&prior.every((v,i)=>equal(v,next[i])),400,'immutable_corrections');
    raw.corrections=[...prior,...next.slice(prior.length).map(c=>{required(typeof c.text==='string'&&c.text.trim().length&&c.text.length<=10000,400,'invalid_correction');return {text:c.text.trim(),at:now(),by:user.id,name:user.name};})];
   }
   if(old&&['designs','estimates','photos'].includes(raw.type))for(const k of ['data','fileName'])required(raw[k]===old[k],400,'original_immutable');
   if(raw.type==='estimates'){
    if(old)required(raw.series===old.series,400,'series_immutable');
    if(raw.series){const head=store.get('items',raw.series);required(head?.type==='estimates'&&head.project===raw.project&&head.company===company,403,'invalid_series');}
    required(!raw.fileName||/\.pdf$/i.test(raw.fileName),400,'pdf_required');
   }
  }
  required(old?Number(baseVersion)===old.version:Number(baseVersion)===0,409,'version_conflict');dates(raw);schedule(raw);
  if(collection==='projects'&&!old&&!raw.homeMessage)raw.homeMessage=store.get('companies',company)?.template||'';
  const record={...raw,id,company,version:(old?.version||0)+1,created:old?.created||now(),updated:now(),uploader:old?.uploader||user.id,uploaderName:old?.uploaderName||user.name};
  if(collection==='items'){
   const ctx={parent:'items:'+id,company,project:raw.project};
   if(record.data)record.data=await storeFile(store,record.data,{...ctx,name:record.fileName,image:raw.type==='photos'},config,driver);
   if(['designs','photos','estimates'].includes(raw.type))required(record.data&&record.fileName,400,'file_required');
   if(record.materialImage)record.materialImage=await storeFile(store,record.materialImage,{...ctx,image:true},config,driver);
   const previews=record.previews||[];required(Array.isArray(previews)&&previews.length<=100,400,'invalid_previews');if(old?.previews)required(old.previews.every(p=>previews.some(n=>n.id===p.id&&n.data===p.data)),400,'preview_preservation');
   record.previews=[];for(const preview of previews){required(typeof preview.id==='string'&&typeof preview.title==='string'&&preview.title.length<=200,400,'invalid_preview');record.previews.push({id:preview.id,title:preview.title,data:await storeFile(store,preview.data,{...ctx,image:true},config,driver)});}
   record.public=record.public===true;record.publishedAt=record.public?(old?.public?old.publishedAt:now()):null;
   record.confirmation=old?.confirmation||null;if(old&&['materials','designs'].includes(raw.type)){const relevant=r=>Object.fromEntries(['title','description','spec','quantity','price','space','category','materialImage','data','previews'].map(k=>[k,r[k]??null]));if(!equal(relevant(old),relevant(record)))record.confirmation=null;}
  }
  store.put(collection,record);
  if(collection==='projects'&&!old)store.put('assignments',{id:uid(),company,project:id,user:user.id,role:user.role,from:null,until:null,revoked:false,canConfirm:false});
  audit(store,user,old,record,collection,old?'changeEdited':'changeCreated');
 }
 return visibleState(store,user);
}
