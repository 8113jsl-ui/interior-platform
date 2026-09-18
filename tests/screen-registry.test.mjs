import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('registered screens have canonical parser-compatible routes and specific IDs',()=>{
 const context=vm.createContext({URLSearchParams,window:{}});
 for(const name of ['core.js','screen-registry.js'])vm.runInContext(readFileSync(new URL('../public/app/'+name,import.meta.url),'utf8'),context);
 const C=context.window.InteriorCore;
 for(const screen of C.screens.filter(s=>s.route)){const route=screen.route.replace(/\{[^}]+\}/g,'example');assert.ok(C.parseRoute(route),screen.SCREEN_ID);}
 assert.equal(C.screenMeta(C.parseRoute('#/pm/project/p/designs/i')).SCREEN_ID,'PM-14');
 assert.equal(C.screenMeta(C.parseRoute('#/customer/project/p/overview')).SCREEN_ID,'CL-03');
 assert.equal(C.screenMeta(C.parseRoute('#/field/photos?project=p')).SCREEN_ID,'FW-01');
 assert.equal(C.screenMeta(C.parseRoute('#/field/project/p/settings')),null);
});
