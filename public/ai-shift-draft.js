import {responseHeader,responseNote,responseDetails,responseMeta,localShiftFields,savedShiftFields,revealResponse} from './ai-response-card.js';
import { scheduleAnswerMessage, showScheduleAnswer } from './ai-schedule.js';
import { createAvailabilityControls, availabilitySummary } from './ai-availability.js';
import { createEmployeeChatState } from './ai-employee-state.js';
import { createEmployeeRequests, employeeSearchMessage } from './ai-employee-request.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import { createChatState, openAiReview, createdShiftMessage } from './ai-chat-state.js';

export function mountAiChat(account, csrfToken) {
  let storage;
  try { storage = sessionStorage; } catch { storage = { getItem() {}, setItem() { throw new Error(); }, removeItem() {} }; }
  const manager = account.user.role === 'manager';
  const chat = (manager ? createChatState : createEmployeeChatState)(storage, `${account.business.id}:${account.user.id}`);
  const launcher = element('button', 'ai-launcher'); launcher.type = 'button'; launcher.id = 'ai-launcher';
  launcher.innerHTML = '<span class="ai-launcher-icon" aria-hidden="true">✦</span><span>AI assistant</span>';
  launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'ai-chat'); launcher.setAttribute('aria-expanded', 'false');
  const dialog = document.createElement('dialog'); dialog.className = 'ai-chat'; dialog.id = 'ai-chat'; dialog.setAttribute('aria-labelledby', 'ai-chat-title');
  dialog.innerHTML = '<div class="ai-chat-header"><div><span class="ai-chat-eyebrow">COVERSHIFT</span><h2 id="ai-chat-title">AI assistant <span aria-hidden="true">✦</span></h2></div><button class="ai-chat-close" type="button" aria-label="Close AI assistant">×</button></div><div class="ai-chat-body"><p class="ai-chat-intro" id="ai-chat-intro"></p><div class="ai-chat-messages" role="log" aria-label="AI conversation" aria-live="polite" aria-relevant="additions"></div><div class="ai-chat-suggestion" hidden></div><p class="ai-chat-status" role="status" tabindex="-1"></p></div><form class="ai-chat-composer"><label for="ai-chat-message">Message AI assistant</label><textarea id="ai-chat-message" rows="1" maxlength="1500" placeholder="Describe a shift, or answer my question…" aria-describedby="ai-chat-privacy"></textarea><div class="ai-chat-controls"><button class="ai-chat-new" type="button">New chat</button><button class="ai-chat-send" type="submit">Send message <span aria-hidden="true">↑</span></button></div><details class="ai-chat-privacy"><summary>Privacy and AI usage</summary><p id="ai-chat-privacy">Chat stays in this tab. Messages and active team names are sent to OpenAI. Avoid sensitive information. Review before saving.</p></details></form>';
  document.body.append(launcher, dialog);
  const find = selector => dialog.querySelector(selector);
  const messages = find('.ai-chat-messages'); const card = find('.ai-chat-suggestion'); const status = find('.ai-chat-status');
  const composer = find('textarea'); const send = find('.ai-chat-send'); const form = find('form');
  const intro = find('#ai-chat-intro');
  intro.textContent = manager ? 'Create a shift or ask about your team’s schedule.' : 'Ask about your work, find an opening, or save availability.';
  if (!manager) { composer.placeholder = 'Find an open shift next Thursday…'; find('#ai-chat-privacy').textContent = 'Chat stays in this tab. Messages are sent to OpenAI; saved shift records stay on this server. Avoid sensitive information. Confirm before requesting.'; }
  let busy = false; let revision = 0; let reviewing = false;
  let mode = chat.value.mode || (manager ? 'draft' : 'search');
  let modeSelect, rulesButton;
  {
    const controls=element('div','ai-chat-modes');const label=element('label','','Chat task');label.htmlFor='ai-chat-mode';
    modeSelect=document.createElement('select');modeSelect.id='ai-chat-mode';
    for(const [value,text] of (manager ? [['draft','Create a shift'],['questions','Ask about schedules']] : [['search','Find existing shifts'],['availability','Save availability'],['questions','Ask about schedules']])){const option=document.createElement('option');option.value=value;option.textContent=text;modeSelect.append(option);}
    modeSelect.value=mode;rulesButton=element('button','ai-chat-new','Saved availability');rulesButton.type='button';controls.append(label,modeSelect);if(!manager)controls.append(rulesButton);form.prepend(controls);
  }
  const samples=element('div','ai-chat-samples');samples.setAttribute('aria-label','Suggested messages');intro.after(samples);
  function working(value) { busy=value;send.disabled=value;find('.ai-chat-controls .ai-chat-new').disabled=value;if(modeSelect)modeSelect.disabled=value;if(rulesButton)rulesButton.disabled=value; }
  function outcomeText(text) { if(chat.value.messages.at(-1)?.role==='assistant')chat.value.messages.at(-1).text=text;chat.save();messages.replaceChildren();for(const message of chat.value.messages)say(message.role,message.text); }
  const availability = !manager ? createAvailabilityControls({chat,card,notice,csrfToken,setBusy:working,onOutcome:outcomeText}) : null;

  const employeeRequests = !manager ? createEmployeeRequests({ chat, card, notice, csrfToken, setBusy: working, onOutcome: outcomeText }) : null;

  composer.value = chat.value.composer;
  function updateMode() {
   composer.placeholder=mode==='questions'?'Ask about your schedule…':manager?'Describe a shift…':mode==='availability'?'Describe your availability…':'Which day can you work?';
   samples.replaceChildren();const prompts=mode==='questions'?(manager?[['Team schedule','Show the entire team’s schedule this week'],['Team hours','How many hours is the entire team scheduled this week?']]:[['My next shift','When is my next shift?'],['My hours this week','How many hours am I working this week?']]):manager?[['Create a shift','Help me create a shift.']]:mode==='availability'?[['Thursday availability','I can take one shift Thursday between 2 PM and 6 PM.']]:[['Thursday openings','Find an open shift Thursday.']];
   for(const [label,text] of prompts){const b=element('button','',label);b.type='button';b.addEventListener('click',()=>{if(busy)return;composer.value=text;chat.value.composer=text;chat.save();composer.focus();});samples.append(b);}samples.hidden=chat.value.messages.length>0;
  }
  updateMode();
  modeSelect?.addEventListener('change',()=>{if(busy)return;revision++;document.dispatchEvent(new Event('ai:cancel-review'));mode=modeSelect.value;employeeRequests?.reset();availability?.reset();chat.reset();chat.value.mode=mode;chat.save();messages.replaceChildren();composer.value='';showSuggestion(null);updateMode();notice(mode==='questions'?'Ask about assigned shifts, a date/week, or hours. This task is read-only.':mode==='availability'?'Describe one dated availability window. Nothing saves until you confirm. Confirming enables automatic requests; assignment still needs manager approval.':manager?'Describe a shift to prepare an editable draft. Nothing saves until you review and create it.':'Find existing openings. Review and confirm before requesting.');composer.focus();});
  if(!manager)rulesButton?.addEventListener('click',()=>{if(busy)return;revision++;employeeRequests.reset();availability.list();});
  function say(role, text) {
    const bubble = element('div', `ai-chat-bubble ai-chat-${role}`);
    bubble.append(element('strong', 'ai-chat-speaker', role === 'user' ? 'You' : 'CoverShift'));
    if(role==='assistant' && text.length>180)bubble.append(responseDetails('View earlier reply',text));else bubble.append(element('p','',text));
    messages.append(bubble);samples.hidden=true; return bubble;
  }
  for (const message of chat.value.messages) say(message.role, message.text);
  function notice(text,announceOnly=false) { status.textContent = text;status.classList.toggle('ai-response-announcement',announceOnly);if(dialog.open&&(!dialog.contains(document.activeElement)||document.activeElement===dialog))composer.focus({preventScroll:true}); }
  function close() { dialog.close(); }
  dialog.addEventListener('close', () => { launcher.setAttribute('aria-expanded', 'false'); if (!reviewing) launcher.focus(); reviewing = false; });
  find('.ai-chat-close').addEventListener('click', close);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]')].filter(node => node.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  launcher.addEventListener('click', () => { dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); composer.focus({preventScroll:true});if(!card.hidden)revealResponse(card); });
  composer.addEventListener('input', () => { chat.value.composer = composer.value; chat.save(); });
  function reviewSuggestion(data) {
    if (busy || chat.value.refinementPending || chat.value.completion || chat.value.uncertainDraftId || data.id !== chat.value.suggestion?.id) return;
    chat.value.pending = { id: data.id, draft: data.draft, timezone: data.timezone, createdAt: Date.now() };
    const persisted = chat.save();
    if (location.pathname === '/workspace/manager/schedule') {
      reviewing = true; close();
      if (openAiReview(data)) { chat.value.pending = null; chat.save(); }
      else { reviewing = false; dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); notice('The shift form is still loading or unavailable. Refresh workers or finish a pending save, then try Review shift again.'); }
    } else if (persisted) { location.assign('/workspace/manager/schedule'); }
    else { chat.value.pending = null; notice('This browser cannot carry a draft between pages. Open Schedule first, then create the suggestion there.'); }
  }
  function showSuggestion(data) {
    card.replaceChildren();card.hidden=!data;if(!data)return;
    const completion=chat.value.completion;
    if(completion && completion.draftId===data.id){
      responseHeader(card,completion.draft?'Private draft saved':'Shift created',completion.draft?'Publish the schedule to release this shift.':'Your shift is saved.','success');
      card.append(savedShiftFields(completion.shift,completion.timezone,completion.shift.assignedWorker.name));
      const schedule=element('a','ai-chat-review','View schedule');schedule.href='/workspace/manager/schedule';
      card.append(responseNote(completion.draft?'This draft is private. The employee will see it after schedule publication.':'Saved successfully. The employee can see this assignment in My shifts.','success'),schedule);return;
    }
    if(chat.value.uncertainDraftId===data.id){
      responseHeader(card,'Save not confirmed','Check your saved schedule.','uncertain');
      card.append(responseNote('The shift may have been saved. Check the schedule before submitting it again.','uncertain'));
      const schedule=element('a','ai-chat-review','Check saved schedule');schedule.href='/workspace/manager/schedule';card.append(schedule);return;
    }
    responseHeader(card,'Draft · Not saved','Here’s the shift to review.');
    card.append(localShiftFields(data.draft,data.workerName,data.timezone));
    const review=element('button','ai-chat-review','Review shift');review.type='button';review.addEventListener('click',()=>reviewSuggestion(data));
    card.append(responseNote('Review and edit the Schedule form, then choose Create shift to save.','neutral'),review);
  }
  function syncResponse(){const bubbles=[...messages.children];for(const bubble of bubbles)bubble.hidden=false;const last=bubbles.at(-1);if(!card.hidden && last?.classList.contains('ai-chat-assistant'))last.hidden=true;}
  const observer=new MutationObserver(()=>{syncResponse();if(dialog.open&&!card.hidden)requestAnimationFrame(()=>revealResponse(card));});observer.observe(card,{childList:true,attributes:true,attributeFilter:['hidden']});
  if (manager) showSuggestion(chat.value.refinementPending ? null : chat.value.suggestion); else if (!chat.value.refinementPending && !availability.restore()) employeeRequests.restore();
  if (!manager && chat.value.availabilityDraft && !chat.value.outcome) notice('Continue describing your availability to review a fresh draft.');
  if (chat.value.completion) notice('Shift saved successfully.');
  else if (chat.value.uncertainDraftId) notice('Save not confirmed. Check the saved schedule before trying again.');
  document.addEventListener('ai:shift-created', event => {
    if (!manager || !chat.markCreated(event.detail?.draftId, event.detail?.result)) return;
    // Replace the old proposed/unsaved reply, keeping bounded alternating history.
    messages.replaceChildren();
    for (const message of chat.value.messages) say(message.role, message.text);
    showSuggestion(chat.value.suggestion); notice('Shift saved successfully.');
  });
  document.addEventListener('ai:shift-save-uncertain', event => {
    if (!manager || !chat.markUncertain(event.detail?.draftId)) return;
    messages.replaceChildren();
    for (const message of chat.value.messages) say(message.role, message.text);
    showSuggestion(chat.value.suggestion); notice('Save not confirmed. Check the saved schedule before trying again.');
  });
  find('.ai-chat-controls .ai-chat-new').addEventListener('click', () => {
    revision++; employeeRequests?.reset(); availability?.reset(); chat.reset(); chat.value.mode=mode;chat.save(); document.dispatchEvent(new Event('ai:cancel-review')); messages.replaceChildren(); showSuggestion(null); composer.value = '';updateMode();
    notice(busy ? 'New chat started. The earlier request may still count toward your allowance; wait for it to finish before sending.' : (mode==='questions'?'Ask about your next assigned shift or a dated schedule/hours window.':manager ? 'New chat started. What shift would you like to create?' : (mode==='availability'?'New chat started. Describe one dated availability window.':'New chat started. Which day would you like to find a shift for?'))); composer.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const text = composer.value.trim();
    if (!text) { notice('Write a message first.'); composer.focus(); return; }
    const history = (chat.value.draftCancelled ? [] : chat.value.messages.slice(-8)).map(({ role, text }) => ({ role, text }));
    const encoder = new TextEncoder();
    while (history.length && encoder.encode(JSON.stringify(history)).length > 4500) history.splice(0, 2);
    if (chat.value.completion || chat.value.uncertainDraftId || chat.value.outcome) {
      notice('Use the saved schedule, coverage or availability controls for existing records. Start a new chat for a new draft.');
      return;
    }
    const base = mode === 'draft' ? chat.value.suggestion?.draft : mode === 'availability' ? chat.value.availabilityDraft : mode === 'search' ? chat.value.criteria : null;
    const body = JSON.stringify({ description: text, history, ...(base && { base }) });
    if (encoder.encode(body).length > 8000) { notice('This chat has reached its context limit. Start a new chat and include the shift details again.'); return; }
    const version = ++revision; busy = true; send.disabled = true; if(modeSelect)modeSelect.disabled=true;if(rulesButton)rulesButton.disabled=true; send.textContent = 'Thinking…';
    if (manager) {
      chat.value.pending = null;
      chat.value.refinementPending = Boolean(base);
      document.dispatchEvent(new Event('ai:cancel-review'));
      showSuggestion(null);
    }
    else {
      chat.value.refinementPending = Boolean(base);
      employeeRequests.reset(); availability.reset();
    }
    chat.save();
    for(const bubble of messages.children)bubble.hidden=false;
    const pendingBubble = say('user', text);
    notice('Preparing a reply… You can close this panel and keep working.');
    try {
      const response = await requestJSON(mode==='questions' ? '/api/ai-schedule-question' : manager ? '/api/manager/ai-shift-draft' : mode==='availability'?'/api/worker/ai-availability-draft':'/api/worker/ai-shift-search', { method: 'POST', readOnly: true, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body });
      if (version !== revision || chat.value.completion || chat.value.uncertainDraftId) {
        pendingBubble.remove();
        return;
      }
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) { const failure = new Error(); failure.userMessage = response.data.message || 'AI could not prepare a reply.'; throw failure; }
      const data = response.data;
      if (!(mode==='questions' ? ['schedule_answer','clarification'] : manager ? ['draft', 'clarification'] : ['matches', 'availability', 'clarification']).includes(data.kind)) throw new Error('AI could not prepare a reply.');
      const reply = data.kind === 'clarification' ? data.question : data.kind==='schedule_answer' ? scheduleAnswerMessage(data) : data.kind==='availability' ? availabilitySummary(data) : !manager ? employeeSearchMessage(data) : `Proposed shift: ${data.draft.title} for ${data.workerName}, ${data.draft.startLocal} to ${data.draft.endLocal}, ${data.timezone}. Nothing has been saved. You can ask me to change it or select Review shift.`;
      chat.value.draftCancelled = false;
      chat.value.messages = [...history, { role: 'user', text }, { role: 'assistant', text: reply }];
      while (messages.children.length > chat.value.messages.length - 1) messages.firstElementChild.remove();
      say('assistant', reply);
      if (data.kind==='schedule_answer') showScheduleAnswer(card,data);
      else if (manager) {
        if (data.kind === 'draft') chat.value.suggestion = { ...data, id: crypto.randomUUID() };
        chat.value.refinementPending = data.kind === 'clarification';
        showSuggestion(chat.value.refinementPending ? null : chat.value.suggestion);
      }
      else if (data.kind === 'availability' || data.kind === 'matches') {
        chat.value.refinementPending = false;
        if (data.kind === 'availability') availability.show(data);
        else employeeRequests.show(data);
      }
      // Preserve anything the user typed while waiting, without sending it yet.
      if (composer.value.trim() === text) composer.value = '';
      chat.value.composer = composer.value; chat.save();
      if(data.kind==='clarification')notice('Reply below to continue.');else notice(card.querySelector('h3')?.textContent||'Your response is ready.',true);
      syncResponse();if(!card.hidden)revealResponse(card);
      if (dialog.open) composer.focus({preventScroll:true});
    } catch (error) {
      pendingBubble.remove();
      if (version === revision && !chat.value.completion && !chat.value.uncertainDraftId) {
        card.replaceChildren(); card.hidden = true;
        chat.value.composer = composer.value; chat.save();
        notice(error.userMessage || `AI is unavailable or took too long. Your message is preserved. Try sending again later${mode==='questions' ? ' or open your saved schedule' : manager ? ' or use the manual Schedule form' : mode==='availability' ? '; Saved availability remains available' : ' or use Open shifts'}. An attempt may still count toward your allowance.`);
      }
    } finally {
      if (version !== revision) notice('The earlier request finished. Your new chat is ready.');
      busy = false; send.disabled = false; if(modeSelect)modeSelect.disabled=false;if(rulesButton)rulesButton.disabled=false; send.innerHTML = 'Send message <span aria-hidden="true">↑</span>';
    }
  });
  // Independent Schedule/roster loading signals when a carried draft can be reviewed.
  document.addEventListener('ai:form-ready', () => {
    const pending = chat.value.pending;
    if (manager && pending && location.pathname === '/workspace/manager/schedule') {
      if (Date.now() - pending.createdAt >= 10 * 60 * 1000) { chat.value.pending = null; chat.save(); notice('The carried draft expired. Open the assistant and request a fresh suggestion.'); return; }
      if (openAiReview(pending)) { chat.value.pending = null; chat.save(); }
    }
  });
  return { clear() { revision++; observer.disconnect(); employeeRequests?.reset(); availability?.reset(); chat.clear(); dialog.remove(); launcher.remove(); } };
}
