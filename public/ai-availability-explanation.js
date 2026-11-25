import { checkedMeta, responseDetails, responseFields, responseHeader, responseNote, savedShiftFields } from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

export function createAvailabilityExplanations({ card, chat, csrfToken, notice, setBusy, onOutcome, onAlternatives }) {
  let generation = 0;
  let busy = false;
  let alternativeContext = null;
  function reset() {
    generation++;
    alternativeContext = null;
    chat.value.explainedShiftId = null;
  }
  function action(label, handler) {
    const button = element('button', 'ai-chat-review', label);
    button.type = 'button'; button.addEventListener('click', handler);
    return button;
  }
  async function load(input) {
    if (busy) return;
    reset();
    const version = generation;
    busy = true; setBusy(true); card.hidden = false;
    card.replaceChildren(element('p', '', 'Checking the saved request and your current schedule…'));
    notice('Checking availability.');
    try {
      const response = await requestJSON('/api/worker/availability-explanation', {
        method: 'POST', readOnly: true,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(input),
      });
      if (version !== generation) return;
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) {
        if (response.status === 404) {
          chat.value.selectedOpeningId = null;
          chat.save();
          const message = 'That request is no longer visible. Choose a current request to check.';
          card.replaceChildren();
          responseHeader(card, 'Opening changed', 'Choose a current request');
          card.append(responseNote(message, 'neutral'), action('Choose a current request', () => {
            if (version === generation) void load({ description: 'Show my coverage requests and openings' });
          }));
          onOutcome(message); notice(message, true);
          if (card.closest('dialog')?.open) card.querySelector('button')?.focus();
          return;
        }
        throw new Error(response.data.message);
      }
      const data = response.data;
      card.replaceChildren();
      if (data.kind === 'explanation_choices') {
        const title = data.choices.length ? 'Which shift or request?' : 'No visible request matches.';
        responseHeader(card, 'Availability explanation', title);
        for (const choice of data.choices) {
          const time = formatShiftTime(choice.shift, data.timezone);
          card.append(action(`${choice.shift.title} · ${time.date} · ${time.startTime} · ${choice.status}`, () => {
            if (version === generation) void load({ requestId: choice.id });
          }));
        }
        if (data.total > data.choices.length) card.append(responseNote('Ask again with the shift title in quotes to narrow the results.'));
        onOutcome(title); notice(title, true);
        card.querySelector('button')?.focus();
        return;
      }
      if (data.kind !== 'availability_explanation') throw new Error('Could not explain that request.');
      chat.value.selectedOpeningId = data.requestId;
      chat.save();
      responseHeader(card, 'Availability explanation', data.shift.title);
      card.append(savedShiftFields(data.shift, data.timezone), responseFields([['Request status', data.status]]));
      if (data.recorded.length) card.append(element('h4', '', 'Recorded outcome'), ...data.recorded.map(line => element('p', '', line)));
      if (data.status === 'open') {
        card.append(element('h4', '', 'Current eligibility'),
          element('p', '', 'These checks describe the current conditions. There is no recorded reason for a missed match.'),
          ...data.current.map(line => element('p', '', line)));
        for (const rule of data.rules) {
          const time = formatShiftTime(rule, rule.timezone);
          card.append(responseDetails(`${rule.title || 'Any shift'} · ${time.date} · ${time.startTime}`,
            `${time.startTime}–${time.endDate ? time.endDate + ' ' : ''}${time.endTime} (${rule.timezone}). ${rule.used} of ${rule.maximum} requests used. ${rule.reasons.join(' ') || 'This rule passes the window, title and capacity checks.'}`));
        }
        if (data.ruleCount > data.rules.length) card.append(responseNote('More rules are available in Saved availability.'));
        card.append(responseNote(data.priority));
      }
      const next = element('a', 'ai-chat-review', data.next === 'open' ? 'View Open shifts' : 'View My requests');
      next.href = data.next === 'open' ? '/workspace/worker/open' : '/workspace/worker/requests';
      card.append(checkedMeta(data.asOf, data.timezone), next,
        action('Check again', () => { if (version === generation) void load({ requestId: data.requestId }); }));
      if (['open', 'expired', 'rejected', 'cancelled'].includes(data.status) && !chat.value.outcome) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: data.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date(data.shift.startsAt));
        const date = ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
        const saved = chat.value.criteria;
        if (!saved || saved.date === date) {
          const criteria = saved || { date, startLocal: '', endLocal: '', title: '' };
          alternativeContext = { shiftId: data.shiftId, criteria, bounded: Boolean(saved) };
          if (saved) chat.value.explainedShiftId = data.shiftId;
          card.append(action(saved ? 'Find alternatives within my search limits' : 'Find alternatives on this date (any hours)', () => {
            if (version === generation && !busy) void onAlternatives(data.shiftId, criteria);
          }));
        }
      }
      onOutcome(`${data.shift.title}. ${data.recorded[0] || data.current[0] || 'Current eligibility checked.'}`);
      notice('Explanation ready.', true);
    } catch (error) {
      if (version !== generation) return;
      card.replaceChildren(responseNote(error.message || 'The explanation could not load.'),
        action('Retry explanation', () => { if (version === generation) void load(input); }));
      onOutcome('Could not load the explanation. You can retry.');
      notice('Could not load the explanation. You can retry.');
    } finally { busy = false; setBusy(false); }
  }
  return { load, reset, alternativeContext: () => alternativeContext };
}
