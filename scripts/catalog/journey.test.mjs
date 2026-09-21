import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
// JSON import(artists.ts → collected-artists.json)는 .ts를 붙이지 않고 데이터로 읽는다.
// 그 파일은 BOM으로 시작한다. 번들러는 넘기지만 JSON.parse는 첫 글자에서 멈춘다.
// `import x from '*.json'`은 CommonJS로 옮기면 `.default`를 읽으므로 번들러처럼 default로 감싼다.
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, URL, TextEncoder, require: id => id.endsWith('.json') ? { default: JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), id), 'utf8').replace(/^﻿/, '')) } : load(path.resolve(path.dirname(file), id + '.ts')) });
  return loaded.exports;
}

import { PGlite } from '@electric-sql/pglite';
const j=load('src/lib/trip/journey.ts');
const v=(id,placeId='music-korea')=>({id,placeId,stay:40});
test('date ranges cover single day, leap day, year boundary and reject invalid/oversized ranges',()=>{
  assert.equal(j.journeyDates('2026-09-21','2026-09-23').length,3);
  assert.equal(j.journeyDates('2024-02-28','2024-03-01').length,3);
  assert.equal(j.journeyDates('2026-12-31','2027-01-01').length,2);
  for(const [a,b] of [['2026-02-29','2026-03-01'],['2026-09-23','2026-09-21'],['2026-01-01','2026-03-01']])assert.equal(j.journeyDates(a,b),null);
});
test('repeat place on different days has distinct visits and round-trips',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-23');
 trip=j.addVisit(trip,v('a'),'2026-09-21');trip=j.addVisit(trip,v('b'),'2026-09-22');
 const restored=j.parseJourney(JSON.parse(JSON.stringify(trip)));assert.equal(restored.days[1].visits[0].placeId,'music-korea');
 assert.throws(()=>j.addVisit(trip,v('a'),'2026-09-23'));
});
test('moving and shrinking preserve visits without mutating original',()=>{
 let trip=j.addVisit(j.createJourney('2026-09-21','2026-09-23'),v('a'),'2026-09-21');
 const moved=j.moveVisit(trip,'a','2026-09-23',0);assert.equal(trip.days[0].visits.length,1);
 const shrunk=j.resizeJourney(moved,'2026-09-21','2026-09-22');assert.equal(shrunk.unassigned[0].id,'a');
 assert.throws(()=>j.moveVisit(trip,'a','2026-09-22',10));assert.equal(trip.days[0].visits.length,1);
});
test('v1 migration preserves selected places, custom events and time buffer',()=>{
 const old={version:1,input:{date:'2026-09-21',start:600,end:1200,stay:60,transfer:35},selected:['music-korea'],personal:[],artistIds:[]};
 const next=j.parseJourney(old);assert.equal(next.days.length,1);assert.equal(next.days[0].bufferMinutes,35);assert.equal(next.days[0].visits[0].stay,60);
});
test('custom restaurant can be added but cannot forge reviewed fields',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');const place={id:'custom-food',title:'내 식당',address:'서울',kind:'restaurant',note:''};
 trip=j.addCustomPlace(trip,place);trip=j.addVisit(trip,v('food',place.id),'2026-09-21');
 assert.equal(j.scheduleJourneyDay(trip,'2026-09-21',()=>5)[0].arrival,null);
 assert.throws(()=>j.addCustomPlace(j.createJourney('2026-09-21','2026-09-21'),{...place,title_ja:'forged'}));
});
test('strict parser rejects broken dates, refs, IDs, durations and UTF8 oversize',()=>{
 const trip=j.createJourney('2026-09-21','2026-09-23');
 for(const mutate of [t=>t.days.reverse(),t=>t.days[0].visits.push(v('bad','absent')),t=>t.days[0].visits.push({...v('bad'),stay:0}),t=>t.days[0].bufferMinutes=-1,t=>t.custom.push({id:'custom-long',title:'x',address:'x',kind:'x',note:'가'.repeat(60000)})]){const t=JSON.parse(JSON.stringify(trip));mutate(t);assert.equal(j.parseJourney(t),null);}
});
test('unknown travel and closed venue are not presented as confirmed schedules',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');trip=j.addVisit(trip,v('a'),'2026-09-21');trip=j.addVisit(trip,v('b'),'2026-09-21');
 assert.equal(j.scheduleJourneyDay(trip,'2026-09-21',()=>null)[1].arrival,null);
 trip=j.addVisit(trip,v('closed','hikr-ground'),'2026-09-21');assert.ok(j.scheduleJourneyDay(trip,'2026-09-21',()=>10)[2].issues.length);
});
test('locked visits stay present with conflicts and individual durations',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');trip=j.addVisit(trip,{...v('a'),stay:90},'2026-09-21');trip=j.addVisit(trip,{...v('b'),lockedAt:620},'2026-09-21');
 const rows=j.scheduleJourneyDay(trip,'2026-09-21',()=>10);assert.equal(rows.length,2);assert.equal(rows[0].departure,690);assert.ok(rows[1].issues.includes('Cannot reach the locked time.'));
});
test('local v2 saves do not overwrite v1 and invalid v2 does not silently fall back',()=>{
 const data=new Map();const storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null};data.set('ultspot.trip.v1','legacy');
 j.saveJourneyLocally(storage,j.createJourney('2026-09-21','2026-09-23'));assert.equal(j.loadJourneyLocally(storage).days.length,3);assert.equal(data.get('ultspot.trip.v1'),'legacy');
 data.set(j.journeyStorageKey,'broken');assert.throws(()=>j.loadJourneyLocally(storage));
});
test('journey SQL preserves ownership isolation and rejects wrong versions and oversized payloads',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 await db.exec(fs.readFileSync('supabase/migrations/202609190001_guest_trips.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202609200001_guest_journeys.sql','utf8'));
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 await db.query('insert into auth.users values ($1),($2)',[a,b]);await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[a]);
 const trip=j.createJourney('2026-09-21','2026-09-23');
 await db.query('insert into public.guest_journeys(owner_id,snapshot) values ($1,$2)',[a,JSON.stringify(trip)]);
 assert.equal((await db.query('select * from public.guest_journeys')).rows.length,1);
 await assert.rejects(db.query('insert into public.guest_journeys(owner_id,snapshot) values ($1,$2)',[b,JSON.stringify(trip)]));
 for(const bad of [{version:1},{...trip,version:3},{...trip,huge:'가'.repeat(30000)}])await assert.rejects(db.query('update public.guest_journeys set snapshot=$1',[JSON.stringify(bad)]));
 await db.query("select set_config('test.uid',$1,false)",[b]);assert.equal((await db.query('select * from public.guest_journeys')).rows.length,0);await db.exec('delete from public.guest_journeys');
 await db.query("select set_config('test.uid',$1,false)",[a]);assert.equal((await db.query('select * from public.guest_journeys')).rows.length,1);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.guest_journeys'));
 }finally{await db.close();}
});

function cloudHarness(initial=null) {
 let saved=initial;let signed=0;let user=null;const tables=[];
 const client={auth:{getSession:async()=>({data:{session:user?{user}:null},error:null}),signInAnonymously:async()=>{signed++;user={id:'guest'};return {data:{user},error:null};}},from:table=>{tables.push(table);return {upsert:async row=>{saved=row.snapshot;return {error:null};},select:()=>({eq:()=>({maybeSingle:async()=>({data:saved?{snapshot:saved}:null,error:null})})}),delete:()=>({eq:async()=>{saved=null;return {error:null};}})};}};
 const loaded={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/lib/trip/journey-cloud.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module:loaded,exports:loaded.exports,process:{env:{NEXT_PUBLIC_ENABLE_CLOUD_TRIPS:'true'}},require:id=>id.includes('supabase/client')?{createClient:()=>client}:id.includes('supabase/env')?{isSupabaseConfigured:true}:j});
 return {run:loaded.exports.cloudJourney,stats:()=>({saved,signed,tables})};
}
test('cloud adapter validates before sign-in, round-trips and deletes only journey table',async()=>{
 const h=cloudHarness();await assert.rejects(h.run('save',{}));assert.equal(h.stats().signed,0);
 assert.equal(await h.run('load'),null);assert.equal(h.stats().signed,0);
 const trip=j.createJourney('2026-09-21','2026-09-23');await h.run('save',trip);assert.equal(h.stats().signed,1);
 assert.equal((await h.run('load')).days.length,3);await h.run('delete');assert.equal(await h.run('load'),null);
 assert.ok(h.stats().tables.every(t=>t==='guest_journeys'));
});

test('editing and deleting a visit preserves other days and original state',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-23');trip=j.addVisit(trip,v('a'),'2026-09-21');trip=j.addVisit(trip,v('b'),'2026-09-23');
 const edited=j.updateVisit(trip,'a',90,700);assert.equal(trip.days[0].visits[0].stay,40);assert.equal(edited.days[0].visits[0].lockedAt,700);
 assert.equal(j.updateVisit(edited,'a',30).days[0].visits[0].lockedAt,undefined);
 assert.equal(j.removeVisit(edited,'a').days[2].visits[0].id,'b');assert.throws(()=>j.updateVisit(edited,'a',-1));
});

test('a locked visit following unknown timing still reports uncertainty',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');trip=j.addVisit(trip,v('a','hikr-ground'),'2026-09-21');trip=j.addVisit(trip,{...v('b'),lockedAt:700},'2026-09-21');
 const rows=j.scheduleJourneyDay(trip,'2026-09-21',()=>10);assert.equal(rows[1].arrival,700);assert.ok(rows[1].issues.includes('Previous visit timing is unconfirmed.'));
});

// journey.ts runs in a vm sandbox, so its objects have that realm's prototypes and
// deepStrictEqual would reject them on identity alone. Compare the plain data instead.
const plain=x=>JSON.parse(JSON.stringify(x));
test('a visit record keeps the day you were there, even after the plan moves it',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-23');trip=j.addVisit(trip,v('a'),'2026-09-21');
 trip=j.markVisited(trip,'a','2026-09-21');
 assert.deepEqual(plain(trip.visited),[{visitId:'a',on:'2026-09-21'}]);
 // Moving the visit to another day does not rewrite where you have already been.
 trip=j.moveVisit(trip,'a','2026-09-23',0);
 assert.deepEqual(plain(trip.visited),[{visitId:'a',on:'2026-09-21'}]);
 // Marking again replaces the day instead of adding a second record.
 trip=j.markVisited(trip,'a','2026-09-22');
 assert.deepEqual(plain(trip.visited),[{visitId:'a',on:'2026-09-22'}]);
 assert.deepEqual(plain(j.unmarkVisited(trip,'a').visited),[]);
 // Shrinking the trip moves the visit to unassigned and keeps the record with it.
 const shrunk=j.resizeJourney(trip,'2026-09-21','2026-09-21');
 assert.equal(shrunk.unassigned[0].id,'a');
 assert.deepEqual(plain(shrunk.visited),[{visitId:'a',on:'2026-09-22'}]);
 // Taking the place out of the trip takes the record with it.
 assert.deepEqual(plain(j.removeVisit(trip,'a').visited),[]);
});
test('a visit record cannot point at a visit that is not in the trip, or at an impossible day',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');trip=j.addVisit(trip,v('a'),'2026-09-21');
 assert.throws(()=>j.markVisited(trip,'ghost','2026-09-21'),/cannot be marked/);
 for(const bad of ['2026-02-30','2026-9-21','yesterday','']) assert.throws(()=>j.markVisited(trip,'a',bad));
 assert.equal(j.parseJourney({...trip,visited:[{visitId:'a',on:'2026-09-21'},{visitId:'a',on:'2026-09-21'}]}),null);
 assert.equal(j.parseJourney({...trip,visited:[{visitId:'a',on:'2026-09-21',at:600}]}),null);
 assert.equal(j.parseJourney({...trip,visited:'2026-09-21'}),null);
});
test('spending is whole won, keeps its own date and only attaches to places in the trip',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-22');trip=j.addVisit(trip,v('a'),'2026-09-21');
 trip=j.addSpend(trip,{id:'s1',on:'2026-09-21',amountKrw:8500,placeId:'music-korea',label:'Cup sleeve set'});
 trip=j.addSpend(trip,{id:'s2',on:'2026-09-21',amountKrw:1350});
 assert.equal(trip.spend.length,2);
 assert.equal(j.parseJourney(JSON.parse(JSON.stringify(trip))).spend[0].amountKrw,8500);
 assert.deepEqual(plain(j.removeSpend(trip,'s1').spend.map(s=>s.id)),['s2']);
 // A place that is not in this trip cannot receive spending, and neither can a fraction of a won.
 assert.throws(()=>j.addSpend(trip,{id:'s3',on:'2026-09-21',amountKrw:100,placeId:'not-a-place'}));
 for(const bad of [0,-100,1.5,100000001,'8500']) assert.throws(()=>j.addSpend(trip,{id:'s4',on:'2026-09-21',amountKrw:bad}));
 assert.throws(()=>j.addSpend(trip,{id:'s1',on:'2026-09-21',amountKrw:100}),/could not be recorded/);
 assert.equal(j.parseJourney({...trip,spend:[{id:'s9',on:'2026-09-21',amountKrw:100,note:'extra'}]}),null);
});
test('a draft saved before these fields existed still loads, and stays loadable after',()=>{
 let trip=j.createJourney('2026-09-21','2026-09-21');trip=j.addVisit(trip,v('a'),'2026-09-21');
 const older=JSON.parse(JSON.stringify(trip));delete older.visited;delete older.spend;
 const loaded=j.parseJourney(older);
 assert.deepEqual(plain(loaded.visited),[]);assert.deepEqual(plain(loaded.spend),[]);
 const store=new Map();
 j.saveJourneyLocally({setItem:(k,val)=>store.set(k,val)},j.markVisited(loaded,'a','2026-09-21'));
 assert.deepEqual(plain(j.loadJourneyLocally({getItem:k=>store.get(k)??null}).visited),[{visitId:'a',on:'2026-09-21'}]);
});
