import {formatShiftTime} from './shift-time.js';
import { element,shiftCard } from './shift-card.js';
import {requestJSON} from './request.js';
export function scheduleAnswerMessage(data){
 const date=new Intl.DateTimeFormat(undefined,{timeZone:'UTC',dateStyle:'medium'});
 const period=data.query.kind==='next'?'Next upcoming assigned shift':`${date.format(new Date(data.query.startDate+'T12:00:00Z'))} – ${date.format(new Date(Date.parse(data.query.endDate+'T12:00:00Z')-86400000))}`;
 const checked=new Intl.DateTimeFormat(undefined,{timeZone:data.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(data.asOf));
 return `${period} · ${data.scope}: ${data.total} assigned shift${data.total===1?'':'s'}, ${data.totalHours} scheduled hours${data.clippedToWindow?' within this window':''}. ${data.pendingClaims} pending coverage claim${data.pendingClaims===1?'':'s'} excluded from hours. Checked ${checked} (${data.timezone}).`;
}
export function showScheduleAnswer(card,data){
 card.replaceChildren();card.hidden=false;
 card.append(element('p','ai-chat-card-label','SAVED SCHEDULE · READ ONLY'),element('h3','',data.query.kind==='hours'?'Scheduled hours':data.query.kind==='next'?'Next assigned shift':'Assigned schedule'),element('p','',scheduleAnswerMessage(data)));
 card.append(element('p','section-note',data.clippedToWindow?'Hours use actual elapsed time inside the selected dates, including any overlapping overnight portion. Team totals sum employee hours.':'Next means the earliest assigned shift starting at or after the time checked.'));
 if(!data.total)card.append(element('p','','No assigned shifts were found for this question. Pending claims do not assign a shift.'));
 for(const shift of data.shifts){const t=formatShiftTime(shift,data.timezone),item=element('article','ai-chat-opening');item.append(element('h4','',shift.title),element('p','',`${t.date} · ${t.startTime} – ${t.endDate ? t.endDate+' · ' : ''}${t.endTime}`),element('p','',`${t.duration} · Assigned to ${shift.workerName}`));const link=element('a','','View saved shift');link.href=shift.href;item.append(link);card.append(item);}
 if(data.total>data.shifts.length)card.append(element('p','section-note',`Showing the first ${data.shifts.length} of ${data.total}. Totals include all matching saved shifts; ask for a narrower window to see the rest.`));
 const schedule=element('a','ai-chat-review','Open saved schedule');schedule.href=data.scheduleHref;card.append(schedule,element('p','section-note','This answer is a snapshot. Ask again to check for changes. No schedule or coverage changes were made.'));
}
export async function mountSelectedScheduleShift(main){
 const id=new URLSearchParams(location.search).get('shift');if(!id)return;
 const box=element('section','panel');box.setAttribute('aria-label','Selected saved shift');main.prepend(box);
 async function load(){box.replaceChildren(element('p','','Loading selected shift…'));
  try{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error();const r=await requestJSON('/api/schedule-shifts/'+id,{cache:'no-store'});if(r.status===401){location.replace('/login?expired=1');return;}if(!r.ok)throw Error();box.replaceChildren(element('h2','','Selected saved shift'),shiftCard(r.data.shift,r.data.timezone,{workerName:r.data.shift.workerName}),element('p','section-note','Current saved assignment. This detail is read-only.'));}
  catch{const retry=element('button','logout-button','Retry selected shift');retry.type='button';retry.addEventListener('click',load);box.replaceChildren(element('p','','This shift could not be loaded or is no longer in your assigned schedule.'),retry);}
 }await load();
}
