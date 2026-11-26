import { createClaimStatus, createCoverStatus, createTimeOffStatus } from './ai-claim-status.js';
import { showWorkingSummary, workingSummaryMessage } from './ai-working-summary.js';
import { createBatchReview } from './ai-shift-batch.js';
import { createAvailabilityExplanations } from './ai-availability-explanation.js';
import { CHAT_ENDPOINTS, MIXED_INTENT_QUESTION, OPENING_CLARIFICATION, availabilityNeedsHours, availabilityRuleCommand, chatClarification, clarificationReplyRoute, openingReference, requestsShiftBatch, routeChat, coworkerLookupDate, coworkersFreeOnDate, workingSummaryWeek } from './ai-chat-routing.js';
import {responseHeader,responseNote,responseDetails,responseMeta,localDate,localShiftFields,savedShiftFields,revealResponse} from './ai-response-card.js';
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
  const samples=element('div','ai-chat-samples');samples.setAttribute('aria-label','Suggested messages');intro.after(samples);
  function working(value) { busy=value;send.disabled=value;find('.ai-chat-controls .ai-chat-new').disabled=value; }
  function outcomeText(text) {
    const last = chat.value.messages.at(-1);
    if (last?.role === 'assistant') {
      last.text = text;
      const bubble = messages.lastElementChild;
      if (bubble?.classList.contains('ai-chat-assistant')) bubble.lastElementChild.replaceWith(assistantReply(text));
    }
    chat.save();
  }
  const claimStatus = !manager ? createClaimStatus({ card, chat, notice, setBusy: working, onOutcome: outcomeText }) : null;
  const coverStatus = !manager ? createCoverStatus({ card, chat, notice, setBusy: working, onOutcome: outcomeText }, account.user.id) : null;
  const timeOffStatus = !manager ? createTimeOffStatus({ card, chat, notice, setBusy: working, onOutcome: outcomeText }) : null;
  const statusLookups = {
    claimStatus: { lookup: claimStatus, reply: 'I’ll check your saved claims.' },
    coverStatus: { lookup: coverStatus, reply: 'I’ll check your sent cover invitations.' },
    timeOffStatus: { lookup: timeOffStatus, reply: 'I’ll check your time-off requests.' },
  };
  const batchReview = manager ? createBatchReview({ card, chat, csrfToken, notice, setBusy: working,
    onOutcome: outcomeText, canAct: () => !busy }) : null;
  const availability = !manager ? createAvailabilityControls({chat,card,notice,csrfToken,setBusy:working,onOutcome:outcomeText}) : null;

  const explanations = !manager ? createAvailabilityExplanations({ chat, card, notice, csrfToken, setBusy: working, onOutcome: outcomeText,
    onAlternatives: showAlternatives,
  }) : null;
  const employeeRequests = !manager ? createEmployeeRequests({ chat, card, notice, csrfToken, setBusy: working, onOutcome: outcomeText }) : null;

  async function showAlternatives(shiftId, criteria) {
    if (await employeeRequests.alternatives(shiftId, criteria)) {
      explanations.reset();
      mode = 'search';
      chat.value.mode = mode;
      chat.save();
    }
  }

  async function loadWorkingSummary(week) {
    if (busy) return;
    working(true);
    notice('Checking saved records…');
    card.hidden = true;
    card.replaceChildren();
    try {
      const response = await requestJSON(`/api/ai-working-summary?week=${week}`, { cache: 'no-store' });
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok || response.data.kind !== 'working_summary') throw new Error();
      const message = workingSummaryMessage(response.data);
      showWorkingSummary(card, response.data, () => void loadWorkingSummary(week));
      outcomeText(message);
      notice(message, true);
    } catch {
      card.hidden = false;
      responseHeader(card, 'Could not refresh', 'Summary unavailable', 'uncertain');
      card.append(responseNote('The latest saved records could not be checked. Try refreshing the summary.', 'uncertain'));
      const retry = element('button', 'ai-chat-review', 'Retry summary');
      retry.type = 'button';
      retry.addEventListener('click', () => void loadWorkingSummary(week));
      card.append(retry);
      outcomeText('Summary unavailable. Retry to check the latest saved records.');
      notice('Summary unavailable. Retry to check the latest saved records.', true);
    } finally { working(false); }
  }

  composer.value = chat.value.composer;
  composer.placeholder = 'Ask or describe what you need…';
  const prompts = manager
    ? [['Create a shift', 'Help me create a shift.'], ['Draft multiple shifts', 'Draft two shifts: '], ['Team schedule', 'Show the entire team’s schedule this week.'], ['Attention summary', 'Show the attention summary for this week.']]
    : [['My next shift', 'When is my next shift?'], ['My working week', 'Show my working week.'], ['Find openings', 'Find an open shift Thursday.'], ['Save availability', 'I can take one shift Thursday between 2 PM and 6 PM.']];
  for (const [label, text] of prompts) {
    const button = element('button', '', label); button.type = 'button';
    button.addEventListener('click', () => {
      if (busy) return;
      composer.value = text; chat.value.composer = text; chat.save(); composer.focus();
    });
    samples.append(button);
  }

  function assistantReply(text) {
    return text.length > 180 ? responseDetails('View earlier reply', text) : element('p', '', text);
  }
  function say(role, text) {
    const bubble = element('div', `ai-chat-bubble ai-chat-${role}`);
    bubble.append(element('strong', 'ai-chat-speaker', role === 'user' ? 'You' : 'CoverShift'));
    bubble.append(role === 'assistant' ? assistantReply(text) : element('p', '', text));
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
  composer.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.shiftKey ||
        event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat && !busy && !send.disabled) form.requestSubmit(send);
  });
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
  if (manager && chat.value.batch) batchReview.show(chat.value.batch);
  else if (manager) showSuggestion(chat.value.refinementPending ? null : chat.value.suggestion);
  else if (!availability.restore() && !chat.value.refinementPending) employeeRequests.restore();
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
    if (chat.value.batch?.status === 'uncertain') {
      notice('Check the batch receipt or retry the same batch before starting a new chat.');
      return;
    }
    revision++; explanations?.reset(); employeeRequests?.reset(); availability?.reset(); const ruleChangePending = chat.value.ruleChangePending; chat.reset();
    if (ruleChangePending) chat.value.ruleChangePending = true;
    mode = manager ? 'draft' : 'search'; chat.save(); document.dispatchEvent(new Event('ai:cancel-review')); messages.replaceChildren(); showSuggestion(null); composer.value = '';samples.hidden = false;
    notice(busy ? 'New chat started. Wait for the earlier request to finish before sending.' : 'New chat started. Type your question below.'); composer.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (chat.value.batch?.status === 'uncertain') {
      notice('Check the batch receipt or retry the same batch before sending another message.');
      return;
    }
    const text = composer.value.trim();
    if (!text) { notice('Write a message first.'); composer.focus(); return; }
    const timingStart = performance.now();
    delete dialog.dataset.progressMs;
    delete dialog.dataset.answerMs;
    const previous = chat.value.messages.at(-1);
    const coworkerDateReply = !manager && previous?.topic === 'coworkers' &&
      /^Which date/.test(previous.text) && routeChat(text, false, null) === 'clarification' &&
      !chatClarification(text, false).startsWith(MIXED_INTENT_QUESTION);
    const previousTopic = previous?.topic;
    const currentTopic = previousTopic === 'summary' || Object.hasOwn(statusLookups, previousTopic)
      ? previousTopic : previous && previousTopic !== 'clarification' ? mode : null;
    const routed = routeChat(text, manager, currentTopic);
    const openingReply = !manager && previous?.topic === 'explanation' &&
      previous.text.startsWith(OPENING_CLARIFICATION) && routed === 'clarification' &&
      !chatClarification(text, false).startsWith(MIXED_INTENT_QUESTION);
    const shortExplanation = !manager && previous?.topic === 'explanation' &&
      routed === 'clarification' && /^why not[.!?]*$/i.test(text) && employeeRequests.openingContext().selectedId;
    const batchReply = manager && chat.value.batchClarifying && routed === 'clarification' &&
      !chatClarification(text, true).startsWith(MIXED_INTENT_QUESTION);
    const previousLookup = statusLookups[previousTopic]?.lookup;
    const choice = previousLookup && routeChat(text, false, null) === 'clarification' &&
      !chatClarification(text, false).startsWith(MIXED_INTENT_QUESTION)
      ? previousLookup.choiceReply(text) : undefined;
    let statusLookup = choice !== undefined || Object.hasOwn(statusLookups, routed);
    let target = statusLookup ? (choice !== undefined ? previousTopic : routed) : (batchReply && 'draft') || ((openingReply || shortExplanation) && 'explanation') || (coworkerDateReply && 'coworkers') || (!manager && previous?.topic === 'clarification' && clarificationReplyRoute(text, previous.text)) ||
      routed;
    if (target === 'clarification' && /^What would you like me to check/.test(chatClarification(text, manager)) &&
        !/^(?:do not|don't|never)\b/i.test(text) && /[a-z]{2}/i.test(text)) {
      working(true);
      try {
        const result = await requestJSON('/api/ai-intent', {
          method: 'POST', readOnly: true,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ description: text }),
        });
        if (result.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
        const intent = result.data?.intent;
        if (result.ok && ['questions', 'summary', ...(manager ? ['draft'] :
          ['search', 'availability', 'coworkers', 'claimStatus', 'coverStatus', 'timeOffStatus'])].includes(intent)) {
          target = intent;
          statusLookup = Object.hasOwn(statusLookups, target);
        }
      } catch {
        // The local clarification remains available when inference fails.
      } finally { working(false); }
    }
    const wasClarifyingBatch = manager && chat.value.batchClarifying;
    const batch = manager && target === 'draft' && (requestsShiftBatch(text) || wasClarifyingBatch);
    const sameTopic = mode === target;
    const inScope = chat.value.messages.slice(-8);
    let history = [];
    if (previous?.topic === 'clarification' && !previous.text.startsWith(MIXED_INTENT_QUESTION) && target !== 'clarification') {
      history = inScope.slice(-2);
    }
    else if (sameTopic && !chat.value.draftCancelled) {
      const topicStart = inScope.findLastIndex(message => message.topic && message.topic !== target);
      history = inScope.slice(topicStart + 1);
    }
    history = history.map(({ role, text }) => ({ role, text }));
    const encoder = new TextEncoder();
    while (history.length && encoder.encode(JSON.stringify(history)).length > 4500) history.splice(0, 2);
    if (!statusLookup && sameTopic && (chat.value.completion || chat.value.uncertainDraftId || chat.value.outcome)) {
      notice('Use the saved schedule, coverage or availability controls for existing records. Start a new chat for a new draft.');
      return;
    }
    function appendTurn(reply) {
      chat.value.messages.push({ role: 'user', text, topic: target }, { role: 'assistant', text: reply, topic: target });
      chat.value.messages = chat.value.messages.slice(-10);
      while (JSON.stringify(chat.value.messages).length >= 10000) chat.value.messages.splice(0, 2);
      while (messages.children.length > chat.value.messages.length - 1) messages.firstElementChild.remove();
      say('assistant', reply);
      if (composer.value.trim() === text) composer.value = '';
      chat.value.composer = composer.value; chat.save();
    }
    if (statusLookup) {
      explanations.reset();
      say('user', text);
      const { lookup, reply } = statusLookups[target];
      if (choice === null) {
        const clarification = 'Which one do you mean? Try a number from the list or add a date and time of day.';
        appendTurn(clarification);
        notice(clarification, true);
      } else {
        appendTurn(reply);
        if (choice !== undefined) await lookup.loadChoice(choice);
        else await lookup.load(text);
      }
      return;
    }
    if (target === 'summary') {
      const week = workingSummaryWeek(text);
      explanations?.reset();
      say('user', text);
      if (!week) {
        showSuggestion(null);
        appendTurn('Which summary should I show, this week or next week?');
        notice('Reply with this week or next week.');
        return;
      }
      appendTurn('I’ll check the saved records for that week.');
      await loadWorkingSummary(week);
      return;
    }
    const { alternateTo, criteria, explainedShiftId } = chat.value;
    const rememberedShift = previous?.topic === 'explanation' ? explainedShiftId || alternateTo
      : ['alternatives', 'search'].includes(previous?.topic) ? alternateTo : null;
    const alternative = explanations?.alternativeContext() ||
      (rememberedShift && criteria ? { shiftId: rememberedShift, criteria, bounded: true } : null);
    if (target === 'alternatives') {
      say('user', text);
      if (!alternative?.bounded) {
        appendTurn(alternative ? 'Use “Find alternatives on this date (any hours)” to approve that search, or tell me the date and hours you prefer.' :
          'Which shift should I use? Ask why a specific opening did not match, or specify the date and hours for a new search.');
        notice('Choose a search scope to continue.');
        return;
      }
      explanations.reset();
      appendTurn('I’ll check alternatives within your current search limits.');
      await showAlternatives(alternative.shiftId, alternative.criteria);
      return;
    }
    explanations?.reset();
    if (!manager && !['search', 'explanation', 'clarification'].includes(target)) {
      chat.value.criteria = null;
      chat.value.alternateTo = null;
    }
    if (target === 'coworkers') {
      employeeRequests.reset();
      availability.reset();
      chat.value.refinementPending = true;
      say('user', text);
      appendTurn('I’ll check your coworkers’ confirmed free windows.');
      card.hidden = false;
      card.append(element('p', '', 'Checking coworker availability…'));
      working(true);
      try {
        const response = await requestJSON('/api/worker/coworker-windows');
        if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
        if (!response.ok) throw new Error('Coworker availability could not load. Try asking again.');
        const data = response.data;
        const date = coworkerLookupDate(text, data.horizon.startDate);
        card.replaceChildren();
        if (!date) {
          card.hidden = true;
          outcomeText('Which date should I check? Say “December 1” or enter a date like 2026-12-01.');
          notice('Reply with the date to continue.');
          return;
        }
        const outside = date < data.horizon.startDate || date > data.horizon.endDate;
        const asksForHours = /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]m|morning|afternoon|evening|noon|midnight|all day)\b/i.test(text);
        const coworkers = outside || asksForHours ? [] : coworkersFreeOnDate(data, date);
        const reply = outside ? 'Coworker free windows are visible within the next 14 days.' :
          asksForHours ? 'Use the specific-shift checker for exact hours or full-shift availability.' :
          coworkers.length ? `${coworkers.map(worker => worker.name).join(', ')} ${coworkers.length === 1 ? 'has' : 'have'} confirmed free time on ${localDate(date)}.` :
          `No confirmed free windows on ${localDate(date)}. A missing window does not mean someone is unavailable.`;
        responseHeader(card, 'Coworker availability', localDate(date));
        card.append(element('p', '', reply));
        for (const worker of coworkers) {
          card.append(element('h4', '', worker.name));
          for (const window of worker.windows) {
            const time = formatShiftTime(window, data.timezone);
            card.append(element('p', '', `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime}`));
          }
        }
        card.append(responseMeta(data.timezone));
        const link = element('a', 'ai-chat-review', 'Open Coworkers');
        link.href = '/workspace/worker/availability#coworkers';
        link.addEventListener('click', click => {
          if (location.pathname !== '/workspace/worker/availability') return;
          const switcher = document.querySelector('#av-coworker-view');
          if (!switcher) return;
          click.preventDefault();
          close();
          if (location.hash !== '#coworkers') switcher.click();
        });
        card.append(link);
        outcomeText(reply); notice(reply, true);
      } catch (error) {
        card.hidden = true; outcomeText(error.message); notice(error.message);
      } finally { working(false); }
      return;
    }
    if (target === 'explanation') {
      const { visibleIds, selectedId } = employeeRequests.openingContext();
      const reference = /^why not[.!?]*$/i.test(text) && selectedId
        ? selectedId : openingReference(text, visibleIds, selectedId);
      if (reference === null) {
        say('user', text);
        appendTurn(visibleIds.length
          ? `${OPENING_CLARIFICATION} Use its shift title or a position in the last results.`
          : `${OPENING_CLARIFICATION} Use its shift title, or refresh the search to refer to a result by position.`);
        notice('Choose an opening to continue.');
        return;
      }
      chat.value.alternateTo = null;
      employeeRequests.reset({ keepSearch: true }); availability.reset();
      chat.value.refinementPending = true;
      say('user', text);
      appendTurn('I’ll check the saved request and your current eligibility.');
      await explanations.load(reference ? { requestId: reference } : { description: text });
      return;
    }
    if (target === 'clarification') {
      chat.value.refinementPending = true;
      chat.value.batch = null;
      chat.value.batchClarifying = false;
      chat.value.pending = null;
      document.dispatchEvent(new Event('ai:cancel-review'));
      employeeRequests?.reset({ keepSearch: !manager && mode === 'search' }); availability?.reset(); showSuggestion(null);
      say('user', text);
      const reply = chatClarification(text, manager);
      appendTurn(reply);
      notice('Reply below to continue.');
      return;
    }
    if (target === 'rules') {
      employeeRequests.reset(); say('user', text);
      const command = availabilityRuleCommand(text);
      appendTurn(command ? 'I’ll check your saved rules for that change.' : 'I’ll load your saved availability.');
      await availability.list(command);
      return;
    }
    if (!sameTopic) {
      Object.assign(chat.value, {
        suggestion: null, pending: null, completion: null, uncertainDraftId: null,
        criteria: null, alternateTo: null, availabilityDraft: null, outcome: null, draftCancelled: false,
      });
      mode = target; chat.value.mode = target;
    }
    if (target === 'availability' && availabilityNeedsHours(text)) {
      employeeRequests.reset(); availability.reset();
      chat.value.availabilityDraft = null;
      chat.value.refinementPending = false;
      say('user', text);
      appendTurn('What hours should I use for that availability? You can give a start and end time or say “all day.”');
      notice('Reply with the hours to continue.');
      return;
    }
    const base = batch || previous?.topic === 'clarification' ? null : mode === 'draft' ? chat.value.suggestion?.draft : mode === 'availability' ? chat.value.availabilityDraft : mode === 'search' ? chat.value.criteria : null;
    const body = JSON.stringify({ description: text, history, ...(batch && { batch: true }), ...(base && { base }) });
    if (encoder.encode(body).length > 8000) { notice('This chat has reached its context limit. Start a new chat and include the shift details again.'); return; }
    const version = ++revision; busy = true; send.disabled = true; send.textContent = 'Thinking…';
    if (manager) {
      chat.value.batch = null;
      chat.value.batchClarifying = false;
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
    // Allow a rendering opportunity before recording visible progress.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (dialog.open && busy && version === revision && status.textContent.startsWith('Preparing a reply')) {
        dialog.dataset.progressMs = String(Math.round(performance.now() - timingStart));
      }
    }));
    try {
      const response = await requestJSON(CHAT_ENDPOINTS[mode], { method: 'POST', readOnly: true, acceptServerErrors: true, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body });
      if (version !== revision || chat.value.completion || chat.value.uncertainDraftId) {
        pendingBubble.remove();
        return;
      }
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) { const failure = new Error(); failure.userMessage = response.data.message || 'AI could not prepare a reply.'; throw failure; }
      let data = response.data;
      if (mode === 'search' && data.kind === 'matches' && base && chat.value.alternateTo) {
        const refreshed = await requestJSON('/api/worker/shift-alternatives', {
          method: 'POST', readOnly: true, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ criteria: data.criteria, excludeShiftId: chat.value.alternateTo }),
        });
        if (version !== revision) { pendingBubble.remove(); return; }
        if (refreshed.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
        if (!refreshed.ok) { const failure = new Error(); failure.userMessage = refreshed.data.message; throw failure; }
        data = refreshed.data;
      }
      if (!(mode==='questions' ? ['schedule_answer','clarification'] : manager ? [batch ? 'batch' : 'draft', 'clarification'] : ['matches', 'availability', 'clarification']).includes(data.kind)) throw new Error('AI could not prepare a reply.');
      const reply = data.kind === 'clarification' ? data.question : data.kind === 'batch' ? `${data.shifts.length} proposed shifts. Review and confirm the batch to save it.` : data.kind==='schedule_answer' ? scheduleAnswerMessage(data) : data.kind==='availability' ? availabilitySummary(data) : !manager ? employeeSearchMessage(data) : `Proposed shift: ${data.draft.title} for ${data.workerName}, ${data.draft.startLocal} to ${data.draft.endLocal}, ${data.timezone}. Nothing has been saved. You can ask me to change it or select Review shift.`;
      chat.value.draftCancelled = false;
      appendTurn(reply);
      if (data.kind==='schedule_answer') showScheduleAnswer(card,data);
      else if (manager && data.kind === 'batch') {
        chat.value.suggestion = null;
        chat.value.refinementPending = false;
        batchReview.open(data);
      }
      else if (manager) {
        chat.value.batchClarifying = batch && data.kind === 'clarification';
        if (data.kind === 'draft') chat.value.suggestion = { ...data, id: crypto.randomUUID() };
        chat.value.refinementPending = data.kind === 'clarification';
        showSuggestion(chat.value.refinementPending ? null : chat.value.suggestion);
      }
      else if (data.kind === 'availability' || data.kind === 'matches') {
        chat.value.refinementPending = false;
        if (data.kind === 'availability') availability.show(data);
        else employeeRequests.show(data);
      }
      chat.save();
      if (data.kind === 'clarification') notice('Reply below to continue.');
      else notice(data.kind === 'matches' ? reply : card.querySelector('h3')?.textContent || 'Your response is ready.', true);
      syncResponse();if(!card.hidden)revealResponse(card);
      dialog.dataset.answerMs = String(Math.round(performance.now() - timingStart));
      if (dialog.open) composer.focus({preventScroll:true});
    } catch (error) {
      pendingBubble.remove();
      if (version === revision && !chat.value.completion && !chat.value.uncertainDraftId) {
        card.replaceChildren(); card.hidden = true;
        if (batch && wasClarifyingBatch) chat.value.batchClarifying = true;
        chat.value.composer = composer.value; chat.save();
        notice(error.userMessage || `AI is unavailable or took too long. Your message is preserved. Try sending again later${mode==='questions' ? ' or open your saved schedule' : manager ? ' or use the manual Schedule form' : mode==='availability' ? '; Saved availability remains available' : ' or use Open shifts'}. An attempt may still count toward your allowance.`);
      }
    } finally {
      if (version !== revision) notice('The earlier request finished. Your new chat is ready.');
      busy = false; send.disabled = false; send.innerHTML = 'Send message <span aria-hidden="true">↑</span>';
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
  return { clear() { revision++; observer.disconnect(); explanations?.reset(); employeeRequests?.reset(); availability?.reset(); chat.clear(); dialog.remove(); launcher.remove(); } };
}
