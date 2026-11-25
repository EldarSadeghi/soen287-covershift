// Separate validation keeps private drafts out of the live shift collection.
export function validateSchedules(db, validateDatabase) {
  const fail = ok => { if(!ok)throw new Error('Invalid database: schedule publication records'); };
  const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.split(',').sort().join(',');
  const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
  const at=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
  const day=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00Z'))&&new Date(x+'T12:00Z').toISOString().slice(0,10)===x;
  for(const key of ['schedulePeriods','scheduleDrafts','schedulePublications','scheduleNotifications']){fail(Array.isArray(db[key]));fail(new Set(db[key].map(r=>r.id)).size===db[key].length);}
  const business=id=>db.businesses.find(b=>b.id===id),worker=(id,b)=>db.users.some(u=>u.id===id&&u.businessId===b&&u.role==='worker');
  const snapshot=s=>validateDatabase({schemaVersion:12,businesses:db.businesses,users:db.users,shifts:[s],coverageRequests:[],availabilityRules:[],availabilityMatches:[],notifications:[],timeOffRequests:[],availabilityWindows:[],coverInvitations:[],coverNotifications:[]});
  for(const p of db.schedulePeriods){fail(exact(p,'id,businessId,startsOn,endsOn,dueOn,timezone')&&id(p.id)&&business(p.businessId)?.timezone===p.timezone&&day(p.startsOn)&&new Date(p.startsOn+'T12:00Z').getUTCDay()===1&&p.endsOn===new Date(Date.parse(p.startsOn+'T12:00Z')+13*86400000).toISOString().slice(0,10)&&p.dueOn===new Date(Date.parse(p.startsOn+'T12:00Z')-7*86400000).toISOString().slice(0,10));}
  fail(new Set(db.schedulePeriods.map(p=>p.businessId+':'+p.startsOn)).size===db.schedulePeriods.length);
  for(const d of db.scheduleDrafts){fail(exact(d,'id,businessId,baseRevision,deleted,shift')&&id(d.id)&&d.id===d.shift?.id&&d.businessId===d.shift.businessId&&typeof d.deleted==='boolean'&&(d.baseRevision===null||/^[a-f0-9]{64}$/.test(d.baseRevision))&&(!d.deleted||d.baseRevision!==null)&&db.schedulePeriods.some(p=>p.businessId===d.businessId));snapshot(d.shift);fail(d.baseRevision!==null||!db.shifts.some(s=>s.id===d.id));}
  for(const r of db.schedulePublications){const p=db.schedulePeriods.find(p=>p.id===r.periodId);fail(exact(r,'id,businessId,periodId,managerId,at,revision,changes')&&id(r.id)&&p?.businessId===r.businessId&&db.users.some(u=>u.id===r.managerId&&u.businessId===r.businessId&&u.role==='manager')&&at(r.at)&&/^[a-f0-9]{64}$/.test(r.revision)&&Array.isArray(r.changes));for(const c of r.changes){fail(exact(c,'before,after')&&(c.before!==null||c.after!==null));for(const s of [c.before,c.after])if(s){fail(s.businessId===r.businessId);snapshot(s);}if(c.before&&c.after)fail(c.before.id===c.after.id);}}
  for(const n of db.scheduleNotifications){const r=db.schedulePublications.find(r=>r.id===n.publicationId);fail(exact(n,'id,businessId,userId,publicationId,createdAt,readAt')&&id(n.id)&&r?.businessId===n.businessId&&worker(n.userId,n.businessId)&&n.createdAt===r.at&&(n.readAt===null||at(n.readAt)&&n.readAt>=n.createdAt));}
}
