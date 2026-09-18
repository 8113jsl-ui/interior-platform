import {createApplication} from './app.mjs';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {stdin,stdout} from 'node:process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {token,digest,now,required} from './security.mjs';

let silent=false;
const output=new Writable({write(chunk,encoding,callback){if(!silent)stdout.write(chunk,encoding);callback();}});
async function setup(app){const rl=createInterface({input:stdin,output,terminal:stdin.isTTY});try{
 const company=await rl.question('Company name: '),name=await rl.question('Initial PM name: '),email=await rl.question('Email: ');
 stdout.write('Password (12+ characters, hidden): ');silent=true;const password=await rl.question('');silent=false;stdout.write('\n');
 stdout.write('Repeat password: ');silent=true;const repeat=await rl.question('');silent=false;stdout.write('\n');required(password===repeat,400,'password_mismatch');
 await app.bootstrap({company,name,email,password});console.log('Company and initial PM created. Login at '+app.config.origin+'/app/');
 }finally{silent=false;rl.close();}}
export async function backup(app,target){const dest=resolve(target);await mkdir(dirname(dest),{recursive:true});await mkdir(dest,{recursive:false});await mkdir(join(dest,'files'));
 // Hold the repository write lock until DB snapshot and immutable file copies complete.
 await app.repo.write(async s=>{const records=[...s.rows.entries()].map(([key,record])=>({kind:key.slice(0,key.indexOf(':')),record}));for(const f of s.list('files'))await writeFile(join(dest,'files',f.id),await app.driver.get(f.id),{mode:0o600});await writeFile(join(dest,'export.json'),JSON.stringify({format:1,created:now(),records},null,2),{mode:0o600});});return dest;}
export async function restore(app,source){const root=resolve(source),dump=JSON.parse(await readFile(join(root,'export.json'),'utf8'));required(dump.format===1&&Array.isArray(dump.records),400,'invalid_backup');
 await app.repo.write(async s=>{required(s.rows.size===0,409,'restore_requires_empty_database');for(const {kind,record}of dump.records){required(typeof kind==='string'&&typeof record?.id==='string',400,'invalid_backup');if(kind==='files'){required(/^[0-9a-f-]{36}$/.test(record.id),400,'invalid_file_id');const bytes=await readFile(join(root,'files',record.id));required(bytes.length===record.size,400,'backup_file_mismatch');await app.driver.put(record.id,bytes);}if(kind!=='sessions'&&kind!=='resets'&&kind!=='invitations')s.put(kind,record);}});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createApplication();try{const [command,arg,flag]=process.argv.slice(2);
 if(command==='setup')await setup(app);
 else if(command==='backup'){required(arg,400,'backup_directory_required');console.log('Backup created: '+await backup(app,arg));}
 else if(command==='restore'){required(arg&&flag==='--confirm',400,'usage_restore_directory_confirm');await restore(app,arg);console.log('Restored into empty database. Previous sessions and tokens were not restored.');}
 else if(command==='reset-password'){required(arg,400,'email_required');const raw=token();await app.repo.write(s=>{const user=s.list('users').find(u=>u.email===arg.toLowerCase()&&u.active);required(user,404,'user_not_found');for(const r of s.list('resets').filter(r=>r.user===user.id))s.remove('resets',r.id);s.put('resets',{id:digest(raw),user:user.id,expiresAt:new Date(Date.now()+3600000).toISOString(),used:null});});console.log(app.config.origin+'/app/#reset='+raw);}
 else console.log('Commands: setup | backup <new-directory> | restore <backup-directory> --confirm | reset-password <email>');
 }catch(e){console.error(e.code||e.message);process.exitCode=1;}finally{await app.close();}
}
