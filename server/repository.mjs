import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

export class Store {
 constructor(rows=[]){this.rows=new Map(rows.map(r=>[r.kind+':'+r.id,JSON.parse(r.body)]));this.dirty=new Map();}
 get(kind,id){const r=this.rows.get(kind+':'+id);return r?structuredClone(r):null;}
 list(kind){return [...this.rows.entries()].filter(([k])=>k.startsWith(kind+':')).map(([,r])=>structuredClone(r));}
 put(kind,row){const key=kind+':'+row.id;this.rows.set(key,structuredClone(row));this.dirty.set(key,{kind,...row});return row;}
 remove(kind,id){this.rows.delete(kind+':'+id);this.dirty.set(kind+':'+id,{kind,id,deleted:true});}
}
export async function openRepository(config){
 await mkdir(config.dataDir,{recursive:true});let pool,sqlite;
 const schema='CREATE TABLE IF NOT EXISTS interior_records (kind TEXT NOT NULL,id TEXT NOT NULL,company TEXT,project TEXT,body TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS interior_company_idx ON interior_records(company,kind);';
 if(config.databaseUrl){const {Pool}=await import('pg');pool=new Pool({connectionString:config.databaseUrl,max:5,ssl:config.postgresSSL?{rejectUnauthorized:true,...(config.postgresCA?{ca:config.postgresCA}:{})}:undefined});await pool.query('CREATE SCHEMA IF NOT EXISTS interior_private; REVOKE ALL ON SCHEMA interior_private FROM PUBLIC;');await pool.query(schema.replaceAll('interior_records','interior_private.records').replaceAll('interior_company_idx','interior_company_idx'));await pool.query("REVOKE ALL ON ALL TABLES IN SCHEMA interior_private FROM PUBLIC; DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON SCHEMA interior_private FROM anon; REVOKE ALL ON ALL TABLES IN SCHEMA interior_private FROM anon; END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON SCHEMA interior_private FROM authenticated; REVOKE ALL ON ALL TABLES IN SCHEMA interior_private FROM authenticated; END IF; END $$;");}else{sqlite=new DatabaseSync(join(config.dataDir,'workspace.sqlite'));sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');sqlite.exec(schema);}
 let queue=Promise.resolve();
 async function run(fn,write){let client;try{
  if(pool){client=await pool.connect();if(write){await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(147852369)');}}
  else if(write)sqlite.exec('BEGIN IMMEDIATE');
  const rows=pool?(await client.query('SELECT kind,id,body FROM interior_private.records')).rows:sqlite.prepare('SELECT kind,id,body FROM interior_records').all();
  const store=new Store(rows),result=await fn(store);
  if(write){for(const row of store.dirty.values()){
   if(row.deleted){if(pool)await client.query('DELETE FROM interior_private.records WHERE kind=$1 AND id=$2',[row.kind,row.id]);else sqlite.prepare('DELETE FROM interior_records WHERE kind=? AND id=?').run(row.kind,row.id);continue;}
   const {kind,...record}=row,args=[kind,row.id,row.company||null,row.project||null,JSON.stringify(record)];
   if(pool)await client.query('INSERT INTO interior_private.records(kind,id,company,project,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(kind,id) DO UPDATE SET company=excluded.company,project=excluded.project,body=excluded.body',args);
   else sqlite.prepare('INSERT INTO interior_records(kind,id,company,project,body) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET company=excluded.company,project=excluded.project,body=excluded.body').run(...args);
  }if(pool)await client.query('COMMIT');else sqlite.exec('COMMIT');}
  return result;
 }catch(e){if(write){try{if(pool&&client)await client.query('ROLLBACK');else if(sqlite)sqlite.exec('ROLLBACK');}catch{}}throw e;}finally{client?.release();}}
 // SQLite single connection must not observe another request's uncommitted writes.
 const enqueue=(fn,write)=>{const result=queue.then(()=>run(fn,write));queue=result.catch(()=>{});return result;};
 return {read:fn=>enqueue(fn,false),write:fn=>enqueue(fn,true),close:async()=>{await queue;if(pool)await pool.end();else sqlite.close();},backend:pool?'postgresql':'sqlite'};
}
