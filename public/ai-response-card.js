import {element} from './shift-card.js';
import {formatShiftTime} from './shift-time.js';
export function responseHeader(card,status,title,tone='neutral'){
 card.classList.add('ai-summary-card');card.setAttribute('role','region');card.setAttribute('aria-label','Assistant response');
 card.append(element('p',`ai-response-status ai-response-${tone}`,status),element('h3','ai-response-title',title));
}
export function responseFields(entries){const dl=element('dl','ai-response-fields');for(const [label,value] of entries)if(value!==null&&value!==undefined&&value!=='')dl.append(element('dt','',label),element('dd','',String(value)));return dl;}
export function responseStats(entries){const group=element('div','ai-response-stats');for(const [value,label] of entries){const stat=element('div','ai-response-stat');stat.append(element('strong','',String(value)),element('span','',label));group.append(stat);}return group;}
export function responseNote(text,tone='pending'){const note=element('div',`ai-response-note ai-response-${tone}`);note.append(element('p','',text));return note;}
export function responseDetails(label,text){const details=element('details','ai-response-details');details.append(element('summary','',label),element('p','',text));return details;}
export function responseMeta(text){return element('p','ai-response-meta',text);}
export function localDate(date){return new Intl.DateTimeFormat(undefined,{timeZone:'UTC',dateStyle:'medium'}).format(new Date(date.slice(0,10)+'T12:00:00Z'));}
export function localClock(value){const [h,m]=value.slice(11).split(':').map(Number);return new Intl.DateTimeFormat(undefined,{timeZone:'UTC',hour:'numeric',minute:'2-digit'}).format(new Date(Date.UTC(2000,0,1,h,m)));}
export function localShiftFields(draft,worker,timezone){return responseFields([['Employee',worker],['Shift',draft.title],['Date',localDate(draft.startLocal)],['Starts',localClock(draft.startLocal)],['Ends',`${draft.endLocal.slice(0,10)!==draft.startLocal.slice(0,10)?localDate(draft.endLocal)+' · ':''}${localClock(draft.endLocal)}`],['Timezone',timezone]]);}
export function savedShiftFields(shift,timezone,worker=null){const t=formatShiftTime(shift,timezone);return responseFields([['Employee',worker],['Shift',shift.title],['Date',t.date],['Starts',t.startTime],['Ends',`${t.endDate?t.endDate+' · ':''}${t.endTime}`],['Duration',t.duration],['Timezone',timezone]]);}
export function checkedMeta(asOf,timezone){return responseMeta(`${timezone} · Checked ${new Intl.DateTimeFormat(undefined,{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(asOf))}`);}
export function revealResponse(card){const body=card.closest('.ai-chat-body');if(!body||card.hidden)return;body.scrollTop+=card.getBoundingClientRect().top-body.getBoundingClientRect().top-8;}
