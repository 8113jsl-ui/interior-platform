import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.mjs';
import {backup,restore} from '../server/cli.mjs';
test('backup restores records and private file bytes into an empty database, excludes sessions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'interior-backup-'));let source,target;
 try{source=await createApplication({dataDir:join(root,'source')});target=await createApplication({dataDir:join(root,'target')});await source.bootstrap({email:'backup@example.test',name:'Backup tester',company:'Backup company',password:'BackupPassword!2026'});
 const fid='00000000-0000-4000-8000-000000000001',bytes=Buffer.from('private file test');await source.driver.put(fid,bytes);await source.repo.write(s=>{s.put('files',{id:fid,size:bytes.length,parent:'test',company:'test'});s.put('sessions',{id:'old-session',user:'test'});});
 await backup(source,join(root,'backup'));await restore(target,join(root,'backup'));assert.equal(await target.repo.read(s=>s.list('users').length),1);assert.equal(await target.repo.read(s=>s.list('sessions').length),0);assert.deepEqual(await target.driver.get(fid),bytes);await assert.rejects(restore(target,join(root,'backup')),/restore_requires_empty_database/);
 }finally{await source?.close();await target?.close();await rm(root,{recursive:true,force:true});}
});
