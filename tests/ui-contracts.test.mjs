import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.mjs';

test('UI data contracts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'interior-ui-contracts-'));
 const app=await createApplication({dataDir:dir,port:0,origin:'http://127.0.0.1',test:true});
 const owner=await app.bootstrap({email:'pm@example.test',name:'PM',company:'Studio',password:'TestPassword!2026'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 async function request(path,{cookie='',body}={}){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const login=await request('/api/login',{body:{email:'pm@example.test',password:'TestPassword!2026'}}),cookie=login.cookie;
 const save=(collection,id,data,baseVersion=0,asCookie=cookie)=>request('/api/changes',{cookie:asCookie,body:{changes:[{collection,id,baseVersion,data}]}});
 try{
  await t.test('projects default home sections and preserve an ordered subset',async()=>{
   const baseProject={id:'p1',title:'Project',status:'planned'};
   const created=await save('projects','p1',baseProject);
   assert.equal(created.status,200);
   assert.deepEqual(created.body.projects.find(project=>project.id==='p1').homeSections,['overview','recent','schedule','resources']);
   const updated=await save('projects','p1',{...baseProject,homeSections:['resources','overview']},1);
   assert.equal(updated.status,200);
   assert.deepEqual(updated.body.projects.find(project=>project.id==='p1').homeSections,['resources','overview']);
   const omitted=await save('projects','p1',{...baseProject,title:'Renamed'},2);
   assert.equal(omitted.status,200);
   assert.deepEqual(omitted.body.projects.find(project=>project.id==='p1').homeSections,['overview','recent','schedule','resources']);
  });

  await t.test('projects reject unknown, duplicate, non-array, and oversized home sections',async()=>{
   const invalidValues=[['overview','unknown'],['overview','overview'],'overview',['overview','recent','schedule','resources','overview']];
   for(const [index,homeSections] of invalidValues.entries()){
    const result=await save('projects',`invalid-${index}`,{id:`invalid-${index}`,title:'Invalid',status:'planned',homeSections});
    assert.equal(result.status,400,JSON.stringify(homeSections));
   }
  });

  await t.test('schedule accepts date-only legacy records and valid Seoul calendar ranges',async()=>{
   const dateOnly=await save('items','date-only',{id:'date-only',project:'p1',type:'schedule',title:'Site visit',date:'2026-02-28'});
   assert.equal(dateOnly.status,200);
   const timed=await save('items','timed',{id:'timed',project:'p1',type:'schedule',title:'Installation',date:'2026-09-18',time:'09:05',endDate:'2026-09-19',endTime:'17:30'});
   assert.equal(timed.status,200);
   assert.equal(timed.body.items.find(item=>item.id==='timed').endTime,'17:30');
  });

  await t.test('schedule rejects impossible dates, malformed times, and reversed ranges',async()=>{
   const invalid=[
    {id:'missing-date'},
    {id:'time-no-date',time:'09:00'},
    {id:'bad-date',date:'2026-02-30'},
    {id:'bad-end-date',date:'2026-02-28',endDate:'2026-02-30'},
    {id:'bad-time',date:'2026-09-18',time:'9:05'},
    {id:'bad-end-time',date:'2026-09-18',time:'09:00',endTime:'24:00'},
    {id:'backward-day',date:'2026-09-19',endDate:'2026-09-18'},
    {id:'backward-time',date:'2026-09-18',time:'17:00',endTime:'09:00'}
   ];
   for(const value of invalid){const result=await save('items',value.id,{...value,project:'p1',type:'schedule',title:'Invalid schedule'});assert.equal(result.status,400,value.id);}
  });

  await t.test('browser date-only form accepts blank optional times and supports clearing them',async()=>{
   const created=await save('items','blank-time',{project:'p1',type:'schedule',title:'Untimed visit',date:'2026-09-18',time:'',endDate:'',endTime:''});
   assert.equal(created.status,200);
   const timed=await save('items','blank-time',{project:'p1',type:'schedule',title:'Visit',date:'2026-09-18',time:'09:00',endTime:'10:00'},1);
   assert.equal(timed.status,200);
   const cleared=await save('items','blank-time',{project:'p1',type:'schedule',title:'Untimed visit',date:'2026-09-18',time:'',endTime:'',endDate:''},2);
   assert.equal(cleared.status,200);
   assert.equal(cleared.body.items.find(i=>i.id==='blank-time').time,undefined);
  });

  await t.test('project home layout remains protected by server permissions',async()=>{
   const policy=await fetch(base+'/api/company',{method:'PUT',headers:{cookie,'Content-Type':'application/json',Origin:base},body:JSON.stringify({id:owner.company,title:'Studio',policies:{participants:true,approvals:true}})});assert.equal(policy.status,200);
   const invitation=await request('/api/invitations',{cookie,body:{company:owner.company,project:'p1',email:'client@example.test',role:'customer'}});
   const token=new URL(invitation.body.url,base).hash.split('=')[1];
   const accepted=await request('/api/accept-invite',{body:{token,name:'Client',password:'ClientPassword!2026'}});
   const attack=await save('projects','p1',{id:'p1',title:'Project',status:'planned',homeSections:['resources']},2,accepted.cookie);
   assert.equal(attack.status,403);
  });
 }finally{await new Promise(resolve=>app.server.close(resolve));await app.close();await rm(dir,{recursive:true,force:true});}
});
