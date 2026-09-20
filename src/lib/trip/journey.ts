import { catalog } from './catalog';
import { artists } from './artists';
import { isPersonalEvent, parseSavedTrip } from './storage';
import { unavailableReason, type FanEvent } from './planner';

export const journeyStorageKey = 'ultspot.journey.v2';
export type Visit = { id: string; placeId: string; stay: number; lockedAt?: number };
export type JourneyDay = { date: string; start: number; end: number; bufferMinutes: number; visits: Visit[] };
export type CustomPlace = { id: string; title: string; address: string; kind: string; note: string };
export type Journey = { version: 2; timezone: 'Asia/Seoul'; startDate: string; endDate: string; days: JourneyDay[]; unassigned: Visit[]; personal: FanEvent[]; custom: CustomPlace[]; artistIds: string[] };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, n = 300): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= n;
const int = (v: unknown, a: number, b: number): v is number => Number.isInteger(v) && Number(v) >= a && Number(v) <= b;
const only = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
export function journeyDates(start: string, end: string): string[] | null {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  if (!valid(start) || !valid(end) || start > end) return null;
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (count > 31) return null;
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0,10));
}
export function createJourney(startDate: string, endDate: string): Journey {
  const dates = journeyDates(startDate,endDate);
  if (!dates) throw new Error('Choose a valid trip of 1–31 days.');
  return { version:2, timezone:'Asia/Seoul', startDate,endDate, days:dates.map(date=>({date,start:600,end:1200,bufferMinutes:45,visits:[]})), unassigned:[],personal:[],custom:[],artistIds:[] };
}
export function parseJourney(value: unknown): Journey | null {
  if (!obj(value)) return null;
  try { if (new TextEncoder().encode(JSON.stringify(value)).length > 60000) return null; } catch { return null; }
  if (value.version === 1) {
    const old = parseSavedTrip(value); if (!old) return null;
    const result = createJourney(old.input.date,old.input.date);
    result.personal = old.personal; result.artistIds = old.artistIds ?? [];
    result.days[0] = { date:old.input.date,start:old.input.start,end:old.input.end,bufferMinutes:old.input.transfer,visits:old.selected.map((placeId,i)=>({id:'legacy-'+i,placeId,stay:old.input.stay})) };
    return result;
  }
  if (value.version !== 2 || value.timezone !== 'Asia/Seoul' || !text(value.startDate,10) || !text(value.endDate,10)) return null;
  const dates = journeyDates(value.startDate,value.endDate);
  if (!dates || !Array.isArray(value.days) || value.days.length !== dates.length || !Array.isArray(value.personal) || value.personal.length>12 || !value.personal.every(isPersonalEvent)) return null;
  if (!Array.isArray(value.custom) || value.custom.length>100 || !value.custom.every(p=>obj(p)&&only(p,['id','title','address','kind','note'])&&text(p.id,80)&&p.id.startsWith('custom-')&&text(p.title)&&text(p.address)&&text(p.kind,80)&&typeof p.note==='string'&&p.note.length<=1500)) return null;
  if (!Array.isArray(value.artistIds) || value.artistIds.length>5 || new Set(value.artistIds).size!==value.artistIds.length || !value.artistIds.every(id=>artists.some(a=>a.id===id))) return null;
  const places = [...catalog,...value.personal,...value.custom].map(p=>p.id);
  if (new Set(places).size!==places.length) return null;
  const seen = new Set<string>();
  const visits = (list: unknown) => Array.isArray(list) && list.length<=100 && list.every(v=>{
    if (!obj(v)||!only(v,['id','placeId','stay','lockedAt'])||!text(v.id,80)||seen.has(v.id)||!text(v.placeId,80)||!places.includes(v.placeId)||!int(v.stay,5,720)||(v.lockedAt!==undefined&&!int(v.lockedAt,0,1439))) return false;
    seen.add(v.id); return true;
  });
  for (let i=0;i<dates.length;i++) {
    const day=value.days[i];
    if (!obj(day)||!only(day,['date','start','end','bufferMinutes','visits'])||day.date!==dates[i]||!int(day.start,0,1438)||!int(day.end,1,1439)||day.start>=day.end||!int(day.bufferMinutes,5,120)||!visits(day.visits)) return null;
  }
  if (!visits(value.unassigned)||seen.size>100) return null;
  return JSON.parse(JSON.stringify({ version:2,timezone:value.timezone,startDate:value.startDate,endDate:value.endDate,days:value.days,unassigned:value.unassigned,personal:value.personal,custom:value.custom,artistIds:value.artistIds })) as Journey;
}
/** Atomic move: errors leave the original untouched; visit IDs survive date/order changes. */
export function moveVisit(journey: Journey, id: string, date: string | null, index: number): Journey {
  const next = parseJourney(journey); if (!next) throw new Error('Invalid journey.');
  const lists = [next.unassigned,...next.days.map(d=>d.visits)];
  const source = lists.find(list=>list.some(v=>v.id===id));
  const target = date===null ? next.unassigned : next.days.find(d=>d.date===date)?.visits;
  if (!source || !target) throw new Error('Unknown visit or day.');
  const at=source.findIndex(v=>v.id===id); const [visit]=source.splice(at,1);
  if (!int(index,0,target.length)) throw new Error('Invalid visit position.');
  target.splice(index,0,visit); return next;
}
export function resizeJourney(journey: Journey, start: string, end: string): Journey {
  const next = parseJourney(journey); const dates=journeyDates(start,end);
  if (!next||!dates) throw new Error('Invalid journey dates.');
  next.unassigned.push(...next.days.filter(d=>!dates.includes(d.date)).flatMap(d=>d.visits));
  next.days=dates.map(date=>next.days.find(d=>d.date===date)??{date,start:600,end:1200,bufferMinutes:45,visits:[]});
  next.startDate=start; next.endDate=end; return next;
}
export type ScheduledVisit = { visit: Visit; arrival: number | null; departure: number | null; issues: string[] };
/** Preserve the user's order and locked visits. Unknown travel never becomes confirmed time. */
export function scheduleJourneyDay(journey: Journey, date: string, travel: (from: string,to: string,date: string)=>number|null): ScheduledVisit[] {
  const checked=parseJourney(journey); if (!checked) throw new Error('Invalid journey.');
  const day=checked.days.find(d=>d.date===date); if (!day) throw new Error('Unknown day.');
  let cursor: number|null=day.start;
  return day.visits.map((visit,i)=>{
    const issues:string[]=[];
    const event=[...catalog,...journey.personal].find(p=>p.id===visit.placeId);
    const reason=event?unavailableReason(event,date):'Opening hours are unconfirmed.';
    if (reason) issues.push(reason);
    const leg=i?travel(day.visits[i-1].placeId,visit.placeId,date):0;
    if (leg===null||!Number.isFinite(leg)||leg<0) { issues.push('Travel time is unconfirmed.'); cursor=null; }
    if (cursor===null && !issues.includes('Travel time is unconfirmed.')) issues.push('Previous visit timing is unconfirmed.');
    let arrival:number|null=cursor===null?null:Math.max(cursor+(leg??0),event?.opens??0);
    if (visit.lockedAt!==undefined) {
      if (arrival!==null&&arrival>visit.lockedAt) issues.push('Cannot reach the locked time.');
      arrival=visit.lockedAt;
      if (event?.opens!==null&&event?.opens!==undefined&&arrival<event.opens) issues.push('Before opening time.');
    }
    const departure=arrival===null?null:arrival+visit.stay;
    if (departure!==null&&(departure>day.end||(event?.closes!==null&&event?.closes!==undefined&&departure>event.closes))) issues.push('Visit ends after available hours.');
    if (arrival!==null&&event?.lastEntry!==undefined&&arrival>event.lastEntry) issues.push('After last entry.');
    cursor=issues.length?null:departure;
    return {visit,arrival:reason&&visit.lockedAt===undefined?null:arrival,departure:reason&&visit.lockedAt===undefined?null:departure,issues};
  });
}

export function addVisit(journey: Journey, visit: Visit, date: string | null): Journey {
  const next=parseJourney(journey); if (!next) throw new Error('Invalid journey.');
  const target=date===null?next.unassigned:next.days.find(d=>d.date===date)?.visits;
  if (!target) throw new Error('Unknown day.'); target.push(visit);
  const checked=parseJourney(next); if (!checked) throw new Error('Invalid or duplicate visit.'); return checked;
}
export function addCustomPlace(journey: Journey, place: CustomPlace): Journey {
  const next=parseJourney(journey); if (!next) throw new Error('Invalid journey.');
  next.custom.push(place); const checked=parseJourney(next);
  if (!checked) throw new Error('Invalid or duplicate personal place.'); return checked;
}
export function saveJourneyLocally(storage: Pick<Storage,'setItem'>, journey: Journey) {
  const checked=parseJourney(journey); if (!checked) throw new Error('Journey is invalid or too large.');
  storage.setItem(journeyStorageKey,JSON.stringify(checked));
}
export function loadJourneyLocally(storage: Pick<Storage,'getItem'>): Journey|null {
  const current=storage.getItem(journeyStorageKey);
  const raw=current??storage.getItem('ultspot.trip.v1'); if (!raw) return null;
  let parsed: Journey|null; try { parsed=parseJourney(JSON.parse(raw)); } catch { throw new Error('Saved journey is incompatible.'); }
  if (!parsed) throw new Error('Saved journey is incompatible.'); return parsed;
}

export function removeVisit(journey: Journey, id: string): Journey {
  const next=parseJourney(journey); if (!next) throw new Error('Invalid journey.');
  next.unassigned=next.unassigned.filter(v=>v.id!==id);
  for (const day of next.days) day.visits=day.visits.filter(v=>v.id!==id);
  return next;
}
export function updateVisit(journey: Journey, id: string, stay: number, lockedAt?: number): Journey {
  const next=parseJourney(journey); if (!next) throw new Error('Invalid journey.');
  const visit=[...next.unassigned,...next.days.flatMap(d=>d.visits)].find(v=>v.id===id);
  if (!visit) throw new Error('Unknown visit.');
  visit.stay=stay; delete visit.lockedAt; if (lockedAt!==undefined) visit.lockedAt=lockedAt;
  const checked=parseJourney(next); if (!checked) throw new Error('Invalid visit time.'); return checked;
}
