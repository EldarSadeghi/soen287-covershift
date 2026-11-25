import { matchingAvailabilityRules } from './ai-chat-routing.js';
import {responseHeader,responseFields,responseStats,responseNote,responseDetails,responseMeta} from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import { requestJSON } from './request.js';
export function availabilitySummary(data) {
 const time=formatShiftTime({startsAt:data.window.startsAt,endsAt:data.window.endsAt},data.draft.timezone);
 return `Proposed availability: ${time.date}, ${time.startTime} – ${time.endDate || time.date} ${time.endTime} (${data.draft.timezone}). Title: ${data.draft.title || 'any shift'}. Maximum ${data.draft.maxClaims} claim${data.draft.maxClaims===1?'':'s'}. Confirm to enable automatic requests for existing and future matching openings. Manager approval is required before assignment.`;
}
export function createAvailabilityControls({chat,card,notice,csrfToken,setBusy,onOutcome}) {
 let generation=0,busy=false;
 const button=(text,fn)=>{const b=element('button','ai-chat-review',text);b.type='button';if(/^(Cancel|Keep|Pause|Resume|Refresh)/.test(text))b.classList.add('ai-response-secondary');b.addEventListener('click',fn);return b;};
 function reset(){generation++;card.replaceChildren();card.hidden=true;}
 function working(value){busy=value;setBusy(value);card.querySelectorAll('button').forEach(b=>b.disabled=value);}
 async function call(path,input){
  const response=await requestJSON(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(input)});
  if(response.status===401){chat.clear();location.replace('/login?expired=1');throw Error('Please sign in again.');}
  if(!response.ok){const e=Error(response.data.message || 'Could not update saved availability.');e.definite=true;throw e;}
  return response.data;
 }
 function receipt(rule=null){
  reset();card.hidden=false;const confirmed=chat.value.outcome?.kind==='availability_saved';
  responseHeader(card,confirmed?'Availability saved':'Save not confirmed',confirmed?'Your availability was saved.':'Check saved availability.',confirmed?'success':'uncertain');
  if(rule)card.append(availabilityFields(rule,rule.timezone,rule.maxClaims,rule.title));
  card.append(responseNote(confirmed?'Eligible openings can produce requests within your limit. Assignment still requires manager approval.':'The rule may have been saved. Check saved availability before confirming a new draft.',confirmed?'pending':'uncertain'),button('View saved availability',()=>list()));
 }
 function availabilityFields(window,timezone,maxClaims,title=''){
  const t=formatShiftTime(window,timezone);return responseFields([['Date',t.date],['Available from',t.startTime],['Available until',`${t.endDate?t.endDate+' · ':''}${t.endTime}`],['Maximum requests',maxClaims],['Shift title',title||'Any title'],['Timezone',timezone]]);
 }
 function show(data){
  reset();const version=generation;card.hidden=false;
  chat.value.availabilityDraft=data.draft;
  responseHeader(card,'Availability draft · Not saved','Is this availability correct?');
  card.append(availabilityFields(data.window,data.draft.timezone,data.draft.maxClaims,data.draft.title),responseNote('Confirming enables automatic requests for eligible openings. Your manager still approves assignment.'),responseDetails('How matching works','The full shift must fit inside this window. Existing assignments, pending claims, rule priority and your request limit are checked before submission.'));
  const confirmationId=crypto.randomUUID();
  const actions=element('div','ai-response-actions');card.append(actions);
  actions.append(button('Cancel draft',()=>{if(busy||version!==generation)return;reset();chat.value.availabilityDraft=null;chat.value.draftCancelled=true;onOutcome('Availability draft cancelled. Nothing was saved.');notice('Draft cancelled. Nothing saved.');}),button('Confirm availability',async()=>{
   if(busy||version!==generation)return;working(true);
   chat.value.availabilityDraft=null;
   chat.value.outcome={kind:'availability_uncertain',title:'Availability'};onOutcome('Availability submission started; confirmation is pending. Check saved availability if interrupted.');chat.save();
   try{
    const result=await call('/api/worker/availability-rules',{confirmationId,draft:data.draft});if(version!==generation)return;
    if(!result.rule?.id || result.rule.confirmationId!==confirmationId)throw Error('Save not confirmed.');
    chat.value.outcome={kind:'availability_saved',title:'Availability'};chat.save();onOutcome('Availability saved. Assignment still requires manager approval.');receipt(result.rule);notice('Availability saved.');
   }catch(error){if(version!==generation)return;
    if(error.definite){chat.value.outcome=null;chat.save();reset();onOutcome('Availability was not saved. Request a fresh draft.');notice(error.message);}
    else{onOutcome('Availability save not confirmed. Check saved availability before retrying.');receipt();notice('Save not confirmed. Check saved availability.');}
   }finally{working(false);}
  }));
 }
 const consequences = {
  pause: 'This rule will stop requesting openings while paused. Previously submitted requests stay in My requests.',
  resume: 'This rule may immediately submit an eligible request. Your manager must approve it before you are assigned.',
  cancel: 'This rule will permanently stop requesting openings. Previously submitted requests stay in My requests.',
 };
 const actionsFor = rule => rule.status === 'active' ? ['pause', 'cancel'] : rule.status === 'paused' ? ['resume', 'cancel'] : [];
 const actionLabel = action => action[0].toUpperCase() + action.slice(1);

 function ruleFields(rule) {
  return [
   element('p', 'ai-response-status', rule.status),
   element('h4', '', rule.title || 'Any shift'),
   availabilityFields(rule, rule.timezone, rule.maxClaims, rule.title),
   responseStats([[rule.usedClaims, 'Requests used'], [rule.remainingClaims, 'Remaining']]),
  ];
 }

 function review(rule, action) {
  if (busy) return;
  reset();
  const version = generation;
  card.hidden = false;
  responseHeader(card, 'Review saved rule', `${actionLabel(action)} this availability rule?`);
  card.append(...ruleFields(rule), responseNote(consequences[action]));
  const actions = element('div', 'ai-response-actions');
  const keep = button('Keep rule', () => {
   if (busy || version !== generation) return;
   onOutcome('Rule review dismissed. No change was sent.');
   void list();
  });
  const confirm = button(`Confirm ${action}`, async () => {
   if (busy || version !== generation) return;
   working(true);
   chat.value.ruleChangePending = true;
   onOutcome('Rule update submitted. Check saved availability if interrupted.');
   let result;
   try {
    result = await call(`/api/worker/availability-rules/${encodeURIComponent(rule.id)}/${action}`, { revision: rule.revision });
    const expected = { pause: 'paused', resume: 'active', cancel: 'cancelled' }[action];
    if (result?.rule?.id !== rule.id || result.rule.status !== expected) throw new Error('Update not confirmed.');
   } catch (error) {
    if (version !== generation) return;
    if (error.definite) chat.value.ruleChangePending = false;
    onOutcome(error.definite ? 'The rule was not updated. Refresh saved availability to review its current status.' :
     'Update not confirmed. Refresh saved availability to see the current status.');
    showRefresh(error.definite ? error.message : 'Update not confirmed. Check the saved rule before trying again.');
    return;
   } finally { working(false); }
   if (version !== generation) return;
   chat.value.ruleChangePending = false;
   onOutcome(result.message);
   reset(); card.hidden = false;
   responseHeader(card, 'Saved rule updated', `Availability ${result.rule.status}.`, 'success');
   card.append(...ruleFields(result.rule), responseNote(result.message), button('View saved availability', () => list()));
   notice(result.message);
  });
  actions.append(keep, confirm); card.append(actions);
  if (card.closest('dialog')?.open) keep.focus();
 }

 function showRefresh(message) {
  reset(); card.hidden = false;
  card.append(element('p', '', message), button('Refresh saved availability', () => list()));
  notice(message);
 }

 async function list(command = null) {
  if (busy) return;
  if (chat.value.ruleChangePending) command = null;
  reset(); const version = generation; working(true);
  card.hidden = false; card.append(element('p', '', 'Loading saved availability…')); notice('Loading saved availability…');
  let data;
  try {
   data = await call('/api/worker/availability-rules');
  } catch (error) {
   if (version === generation) showRefresh(error.message || 'Could not load saved availability. Try again.');
   return;
  } finally { working(false); }
  if (version !== generation) return;
  chat.value.ruleChangePending = false; chat.save();
  const matches = command ? matchingAvailabilityRules(data.rules, command.selector) : [];
  if (matches.length === 1 && actionsFor(matches[0]).includes(command.action)) {
   review(matches[0], command.action);
   notice('Review the rule and confirm below.');
   return;
  }
  card.replaceChildren();
  responseHeader(card, 'Saved rules', 'Your availability.');
  if (command) {
   const guidance = matches.length > 1 ? 'More than one rule matches. Choose the exact rule below.' :
    matches.length === 1 ? 'That action is unavailable for this rule’s current status.' :
    'No current rule matches. Try the rule title, weekday or full date, or choose below.';
   card.append(responseNote(guidance)); notice(guidance);
  } else notice('Saved availability is up to date.');
  if (!data.rules.length) card.append(element('p', '', 'No saved availability. Describe a date and hours in chat to draft a rule.'));
  for (const rule of matches.length > 1 ? matches : data.rules) {
   const section = element('section', 'ai-chat-opening');
   section.append(...ruleFields(rule));
   for (const match of rule.matches || []) {
    const time = formatShiftTime(match, rule.timezone);
    section.append(element('p', '', `${match.title} · ${time.date} · ${time.startTime} – ${time.endDate ? time.endDate+' · ' : ''}${time.endTime} · ${match.status === 'pending' ? 'Awaiting manager approval' : match.status}`));
   }
   if (rule.usedClaims) {
    const requests = element('a', 'ai-chat-review', 'View My requests'); requests.href = '/workspace/worker/requests'; section.append(requests);
   }
   for (const action of actionsFor(rule)) {
    section.append(button(`${actionLabel(action)} rule`, () => {
     if (version === generation) review(rule, action);
    }));
   }
   card.append(section);
  }
  card.append(button('Refresh saved availability', () => list()));
 }

 return {show, list, reset, restore(){
  if (chat.value.ruleChangePending) { showRefresh('A rule update was not confirmed. Refresh saved availability to check its status.'); return true; }
  if (chat.value.outcome?.kind?.startsWith('availability_')) { receipt(); return true; }
  return false;
 }};
}
