import {randomBytes,createHash,scrypt as rawScrypt,timingSafeEqual,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt);
export const uid=()=>randomUUID(),now=()=>new Date().toISOString(),token=()=>randomBytes(32).toString('base64url'),digest=x=>createHash('sha256').update(String(x)).digest('hex');
export function fail(status,code,message=code){throw Object.assign(new Error(message),{status,code});}
export function required(condition,status=403,code='forbidden'){if(!condition)fail(status,code);}
export function email(value){const s=String(value||'').trim().toLowerCase();required(s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),400,'invalid_email');return s;}
export async function passwordHash(password){required(typeof password==='string'&&password.length>=12&&password.length<=256,400,'password_length');const salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(password,salt,64)).toString('hex');}
export async function passwordValid(password,hash){if(typeof password!=='string'||password.length>256)return false;const [salt,key]=(hash||'00:00').split(':');const actual=Buffer.from(await scrypt(password,salt,64)),expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role};}
export function member(store,user,company){return store.list('memberships').find(m=>m.user===user.id&&m.company===company&&m.active);}
export function manager(store,user,company){return !!member(store,user,company)?.canManage;}
export function assignment(store,user,project){const p=store.get('projects',project);if(!p||!member(store,user,p.company))return null;const date=new Date().toISOString().slice(0,10);return store.list('assignments').find(a=>a.project===project&&a.user===user.id&&!a.revoked&&(!a.from||a.from<=date)&&(!a.until||a.until>=date))||null;}
export function canProject(store,user,p){return !!p&&!p.archived&&!!assignment(store,user,p.id)&&(user.role==='pm'||user.role==='field'||p.public===true);}
export function canItem(store,user,item){const p=store.get('projects',item?.project);return !!item&&!item.archived&&canProject(store,user,p)&&(user.role==='pm'||user.role==='field'&&item.type==='photos'||user.role==='customer'&&item.public===true);}
export function companiesFor(store,user){return store.list('companies').filter(c=>member(store,user,c.id)).map(c=>({...c,canManage:manager(store,user,c.id)}));}
export function visibleState(store,user){
 const projects=store.list('projects').filter(p=>canProject(store,user,p)).map(p=>({...p,companyTitle:store.get('companies',p.company)?.title}));
 const items=store.list('items').filter(i=>canItem(store,user,i)),projectIds=new Set(projects.map(p=>p.id)),itemIds=new Set(items.map(i=>i.id));
 const companies=companiesFor(store,user),managed=new Set(companies.filter(c=>c.canManage).map(c=>c.id));
 const clients=user.role==='pm'?store.list('clients').filter(c=>member(store,user,c.company)&&!c.archived).map(c=>({...c,projects:(c.projects||[]).filter(p=>projectIds.has(p))})):[];
 const clientIds=new Set(clients.map(c=>c.id));
 const allowedTarget=h=>h.type==='client'?clientIds.has(h.idRef):h.type==='overview'?projectIds.has(h.project):itemIds.has(h.idRef);
 const history=store.list('history').filter(h=>allowedTarget(h)&&(user.role==='pm'||h.after?.public===true)).sort((a,b)=>b.at.localeCompare(a.at)).map(h=>user.role==='pm'?h:{id:h.id,project:h.project,type:h.type,idRef:h.idRef,title:items.find(i=>i.id===h.idRef)?.title||projects.find(p=>p.id===h.project)?.title,key:h.key,at:h.at});
 const notifications=store.list('notifications').filter(n=>n.user===user.id&&allowedTarget(n)).sort((a,b)=>b.at.localeCompare(a.at));
 const assignments=store.list('assignments').filter(a=>managed.has(a.company)||a.user===user.id).map(a=>({...a,name:store.get('users',a.user)?.name}));
 const members=store.list('memberships').filter(m=>managed.has(m.company)).map(m=>{const u=store.get('users',m.user);return {id:m.id,user:m.user,company:m.company,name:u?.name,email:u?.email,role:u?.role,active:m.active,canManage:m.canManage};});
 return {projects,items,clients,history,notifications,assignments,members,companies};
}
export function audit(store,user,before,after,kind,key='changeEdited'){
 const safe=r=>r?Object.fromEntries(Object.entries(r).filter(([k])=>!['data','previews','materialImage'].includes(k))):null;
 const event={id:uid(),company:after.company,project:kind==='projects'?after.id:after.project||null,type:kind==='projects'?'overview':kind==='clients'?'client':after.type,idRef:after.id,title:after.title,key,at:now(),actor:user.id,actorName:user.name,before:safe(before),after:safe(after)};
 store.put('history',event);
 if(event.project)for(const a of store.list('assignments').filter(a=>a.project===event.project&&a.user!==user.id&&!a.revoked)){
  const recipient=store.get('users',a.user);if(!recipient)continue;
  if(kind==='projects'?!canProject(store,recipient,after):!canItem(store,recipient,after))continue;
  store.put('notifications',{id:uid(),company:event.company,user:a.user,project:event.project,type:event.type,idRef:event.idRef,title:event.title,at:event.at,read:false});
 }
}
