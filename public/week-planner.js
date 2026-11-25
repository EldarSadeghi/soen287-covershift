import {element} from './shift-card.js';

export const plannerDate = value => typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00Z'))&&new Date(value+'T12:00Z').toISOString().slice(0,10)===value;
export function plannerAddDays(day,count){return new Date(Date.parse(day+'T12:00Z')+count*86400000).toISOString().slice(0,10);}
export function plannerMonday(day){const weekday=new Date(day+'T12:00Z').getUTCDay();return plannerAddDays(day,-((weekday+6)%7));}
function businessDay(timezone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
// Preview the actual elapsed duration in the business timezone. The server still
// authorizes the save and rejects skipped/repeated local times independently.
export function plannerInstant(value,timezone){
  const naive=Date.parse(value+':00Z');if(!Number.isFinite(naive))throw new Error('Choose a valid date and time.');
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=t=>{const p=Object.fromEntries(fmt.formatToParts(new Date(t)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;};
  const offsets=new Set();for(let h=-48;h<=48;h+=6){const t=naive+h*3600000;offsets.add(Date.parse(local(t)+'Z')-t);}
  const matches=[...offsets].map(offset=>naive-offset).filter(t=>local(t)===value+':00');
  if(matches.length!==1)throw new Error(matches.length?'This time occurs twice when the clocks change. Choose another time.':'This time does not exist when the clocks change. Choose another time.');return matches[0];
}
export function plannerRange({date,start,end,overnight=false,endDate=''},timezone){
  if(!plannerDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))throw new Error('Choose a shift date, start time and end time.');
  const finish=endDate||plannerAddDays(date,overnight?1:0);if(!plannerDate(finish))throw new Error('Choose a valid finish date.');
  const startLocal=date+'T'+start,endLocal=finish+'T'+end,minutes=(plannerInstant(endLocal,timezone)-plannerInstant(startLocal,timezone))/60000;
  if(minutes<=0)throw new Error('Finish must be after start. Choose a later time or Ends next day.');
  return {startLocal,endLocal,minutes};
}
const shortDay=day=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(day+'T12:00Z'));
const timeLabel=time=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit'}).format(new Date('2000-01-01T'+time+':00Z'));
export function mountWeekPlanner({startInput,endInput,timezone,followPeriod=false}){
  const field=element('fieldset','week-planner');field.append(element('legend','','Shift date & hours'));
  const startField=startInput.closest('.team-field'),endField=endInput.closest('.team-field');startField.hidden=endField.hidden=true;startField.before(field);
  const prefix=startInput.id+'-planner';let base=document.querySelector('#publication-start')?.value||plannerMonday(startInput.value.slice(0,10)||businessDay(timezone));
  const heading=element('div','planner-heading'),period=element('strong'),zone=element('span','section-note',timezone);heading.append(period,zone);
  const grid=element('div','planner-days');grid.setAttribute('role','group');grid.setAttribute('aria-label','Choose shift day');
  const dateLabel=element('label','planner-date','Shift date'),date=element('input');date.type='date';date.min='2000-01-01';date.max='2099-12-31';date.id=prefix+'-date';dateLabel.htmlFor=date.id;dateLabel.append(date);
  const presets=element('div','planner-presets');presets.setAttribute('role','group');presets.setAttribute('aria-label','Shift time presets');
  const row=element('div','planner-times'),start=element('select'),end=element('select');
  for(const [control,label,suffix] of [[start,'From','from'],[end,'Until','until']]){control.id=prefix+'-'+suffix;control.setAttribute('aria-label',label);const caption=element('label','',label);caption.htmlFor=control.id;caption.append(control);row.append(caption);for(let n=0;n<1440;n+=15){const t=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');control.append(new Option(timeLabel(t),t));}}
  const nightLabel=element('label','planner-night'),night=element('input');night.type='checkbox';nightLabel.append(night,document.createTextNode('Ends next day'));
  const advanced=element('details','planner-advanced');advanced.append(element('summary','','Different finish date'));
  const finishLabel=element('label','','Finish date'),finish=element('input');finish.type='date';finish.min='2000-01-01';finish.max='2099-12-31';finish.id=prefix+'-finish';finishLabel.htmlFor=finish.id;finishLabel.append(finish);advanced.append(finishLabel);
  const summary=element('p','planner-summary'),error=element('p','field-error');summary.setAttribute('role','status');error.setAttribute('role','alert');error.id=prefix+'-error';error.hidden=true;
  for(const input of [date,start,end,night,finish])input.setAttribute('aria-describedby',error.id);
  field.append(heading,grid,dateLabel,presets,row,nightLabel,advanced,summary,error);
  function setOption(control,value){if(![...control.options].some(o=>o.value===value))control.append(new Option(timeLabel(value),value));control.value=value;}
  function display(){
    period.textContent=shortDay(base)+' – '+shortDay(plannerAddDays(base,13));grid.replaceChildren();
    for(let n=0;n<14;n++){const day=plannerAddDays(base,n),button=element('button','planner-day');button.type='button';const weekday=element('small','',new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short'}).format(new Date(day+'T12:00Z')));button.append(weekday,element('span','',String(Number(day.slice(-2)))));button.setAttribute('aria-label',new Intl.DateTimeFormat('en-US',{timeZone:'UTC',dateStyle:'full'}).format(new Date(day+'T12:00Z')));button.setAttribute('aria-pressed',String(date.value===day));button.addEventListener('click',()=>{date.value=day;write();grid.querySelector('[aria-pressed="true"]')?.focus();});grid.append(button);}
    for(const button of presets.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.start===start.value&&button.dataset.end===end.value&&!night.checked&&!finish.value));
    error.hidden=true;
    if(!date.value){summary.textContent='Choose a day to preview your shift.';return;}
    try{const range=plannerRange({date:date.value,start:start.value,end:end.value,overnight:night.checked,endDate:finish.value},timezone);const h=Math.floor(range.minutes/60),m=range.minutes%60;summary.textContent=(h?h+' hr ':'')+(m?m+' min':'')+' · '+shortDay(date.value)+' · '+timeLabel(start.value)+' – '+(range.endLocal.slice(0,10)!==date.value?shortDay(range.endLocal.slice(0,10))+' · ':'')+timeLabel(end.value);}
    catch(e){summary.textContent='Check the shift times';error.textContent=e.message;error.hidden=false;}
  }
  function write(){startInput.value=date.value&&start.value?date.value+'T'+start.value:'';const endDay=finish.value||date.value&&plannerAddDays(date.value,night.checked?1:0);endInput.value=endDay&&end.value?endDay+'T'+end.value:'';startInput.dispatchEvent(new Event('input',{bubbles:true}));endInput.dispatchEvent(new Event('input',{bubbles:true}));display();}
  function read(){const a=startInput.value,b=endInput.value;date.value=a.slice(0,10);setOption(start,a.slice(11)||'14:00');setOption(end,b.slice(11)||'17:00');const delta=a&&b?(Date.parse(b.slice(0,10)+'T12:00Z')-Date.parse(a.slice(0,10)+'T12:00Z'))/86400000:0;night.checked=delta===1;finish.value=delta!==0&&delta!==1?b.slice(0,10):'';advanced.open=Boolean(finish.value);if(date.value&&(date.value<base||date.value>plannerAddDays(base,13)))base=plannerMonday(date.value);display();}
  for(const [label,a,b] of [['Morning · 9–12','09:00','12:00'],['Afternoon · 2–5','14:00','17:00'],['Evening · 5–10','17:00','22:00']]){const button=element('button','planner-preset',label);button.type='button';button.dataset.start=a;button.dataset.end=b;button.addEventListener('click',()=>{start.value=a;end.value=b;night.checked=false;finish.value='';advanced.open=false;write();});presets.append(button);}
  date.addEventListener('change',()=>{if(plannerDate(date.value)&&(date.value<base||date.value>plannerAddDays(base,13)))base=plannerMonday(date.value);write();});
  for(const input of [start,end])input.addEventListener('change',write);
  night.addEventListener('change',()=>{finish.value='';advanced.open=false;write();});finish.addEventListener('change',()=>{night.checked=false;write();});
  if(followPeriod)document.addEventListener('schedule:period-viewed',event=>{if(plannerDate(event.detail?.startsOn)){base=event.detail.startsOn;display();}});
  read();return {read,showErrors(fields){const message=fields.startLocal||fields.endLocal;if(message){error.textContent=message;error.hidden=false;}},validate(){if(error.hidden)return true;return false;}};
}
