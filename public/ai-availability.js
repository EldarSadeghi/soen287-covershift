import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import { requestJSON } from './request.js';
export function availabilitySummary(data) {
 const time=formatShiftTime({startsAt:data.window.startsAt,endsAt:data.window.endsAt},data.draft.timezone);
 return `Proposed availability: ${time.date}, ${time.startTime} – ${time.endDate || time.date} ${time.endTime} (${data.draft.timezone}). Title: ${data.draft.title || 'any shift'}. Maximum ${data.draft.maxClaims} claim${data.draft.maxClaims===1?'':'s'}. Confirm before saving. Manager approval will be required. Automatic matching is not running yet.`;
}
export function createAvailabilityControls({chat,card,notice,csrfToken,setBusy,onOutcome}) {
 let generation=0,busy=false;
 const button=(text,fn)=>{const b=element('button','ai-chat-review',text);b.type='button';b.addEventListener('click',fn);return b;};
 function reset(){generation++;card.replaceChildren();card.hidden=true;}
 function working(value){busy=value;setBusy(value);card.querySelectorAll('button').forEach(b=>b.disabled=value);}
 async function call(path,input){
  const response=await requestJSON(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(input)});
  if(response.status===401){chat.clear();location.replace('/login?expired=1');throw Error('Please sign in again.');}
  if(!response.ok){const e=Error(response.data.message || 'Could not update saved availability.');e.definite=true;throw e;}
  return response.data;
 }
 function receipt(){
  reset();card.hidden=false;const confirmed=chat.value.outcome?.kind==='availability_saved';
  card.append(element('p','ai-chat-card-label',confirmed?'AVAILABILITY SAVED':'SAVE NOT CONFIRMED'),element('p','',confirmed?'Your availability was saved. Automatic matching is not running yet. No shift has been requested or assigned.':'The rule may have been saved. Check saved availability before confirming a new draft.'),button('View saved availability',list));
 }
 function show(data){
  reset();const version=generation;card.hidden=false;
  card.append(element('p','ai-chat-card-label','AVAILABILITY DRAFT · NOT SAVED'),element('p','',availabilitySummary(data)));
  const confirmationId=crypto.randomUUID();
  card.append(button('Cancel draft',()=>{if(busy)return;reset();onOutcome('Availability draft cancelled. Nothing was saved.');notice('Draft cancelled. Nothing saved.');}),button('Confirm availability',async()=>{
   if(busy||version!==generation)return;working(true);
   chat.value.outcome={kind:'availability_uncertain',title:'Availability'};onOutcome('Availability submission started; confirmation is pending. Check saved availability if interrupted.');chat.save();
   try{
    const result=await call('/api/worker/availability-rules',{confirmationId,draft:data.draft});if(version!==generation)return;
    if(!result.rule?.id || result.rule.confirmationId!==confirmationId)throw Error('Save not confirmed.');
    chat.value.outcome={kind:'availability_saved',title:'Availability'};chat.save();onOutcome(result.message);receipt();notice(result.message);
   }catch(error){if(version!==generation)return;
    if(error.definite){chat.value.outcome=null;chat.save();reset();onOutcome('Availability was not saved. Request a fresh draft.');notice(error.message);}
    else{onOutcome('Availability save not confirmed. Check saved availability before retrying.');receipt();notice('Save not confirmed. Check saved availability.');}
   }finally{working(false);}
  }));
 }
 async function list(){
  if(busy)return;reset();const version=generation;working(true);card.hidden=false;card.append(element('p','','Loading saved availability…'));notice('Loading saved availability…');
  try{
   const data=await call('/api/worker/availability-rules');if(version!==generation)return;card.replaceChildren();
   card.append(element('h3','','Saved availability'),element('p','','Automatic matching is not running yet. These saved rules will need manager approval for any future claims.'));
   if(!data.rules.length)card.append(element('p','','No saved availability. Choose Save availability and describe one date.'));
   for(const rule of data.rules){
    const section=element('section','ai-chat-opening'); const time=formatShiftTime(rule,rule.timezone);
    section.append(element('h3','',rule.title || 'Any shift'),element('p','',`${time.date} · ${time.startTime} – ${time.endDate || time.date} ${time.endTime} (${rule.timezone})`),element('p','',`${rule.status.toUpperCase()} · Maximum ${rule.maxClaims} claim${rule.maxClaims===1?'':'s'}`));
    const change=async action=>{
     if(busy||version!==generation)return;working(true);notice(`Updating availability…`);
     try{const result=await call(`/api/worker/availability-rules/${encodeURIComponent(rule.id)}/${action}`,{revision:rule.revision});if(version!==generation)return;notice(result.message);working(false);await list();}
     catch(error){if(version===generation){section.querySelectorAll('button').forEach(b=>b.remove());section.append(element('p','',error.definite?error.message:'Update not confirmed. Refresh saved availability before trying again.'));notice('Refresh saved availability to check the current status.');}}
     finally{working(false);}
    };
    if(['active','paused'].includes(rule.status)){
     section.append(button(rule.status==='active'?'Pause rule':'Resume rule',()=>change(rule.status==='active'?'pause':'resume')));
     const confirm=element('div','coverage-confirm');confirm.hidden=true;
     const cancel=button('Cancel rule',()=>{if(busy)return;confirm.hidden=false;keep.focus();});
     const keep=button('Keep rule',()=>{if(!busy){confirm.hidden=true;cancel.focus();}});
     confirm.append(element('p','','Cancel this saved availability? It will no longer be eligible for future matching.'),keep,button('Confirm cancellation',()=>change('cancel')));section.append(cancel,confirm);
    }
    card.append(section);
   }
   card.append(button('Refresh saved availability',list));notice('Saved availability is up to date. No automatic requests are running.');
  }catch(error){if(version===generation){card.replaceChildren(element('p','',error.message || 'Could not load saved availability.'),button('Retry saved availability',list));notice('Could not load saved availability. Try again.');}}
  finally{working(false);}
 }
 return {show,list,reset,restore(){if(chat.value.outcome?.kind?.startsWith('availability_')){receipt();return true;}return false;}};
}
