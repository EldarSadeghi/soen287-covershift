import { coworkerLookupDate } from './ai-chat-routing.js';
import { checkedMeta, responseHeader } from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

const labels = {
  pending: 'Awaiting manager approval', approved: 'Approved', rejected: 'Declined',
  cancelled: 'Cancelled', expired: 'Expired',
};
const normalize = text => text.trim().toLocaleLowerCase();
const weekday = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi;
const explicitDate = /\b(?:today|tomorrow|(?:this|next|last) week|\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

function localDay(value, timezone) {
  const fields = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(key => fields.find(part => part.type === key).value).join('-');
}

export function matchingClaims({ claims, timezone, asOf }, text) {
  const quoted = [...text.matchAll(/["“]([^"”]+)["”]/g)];
  if (quoted.length > 1) return null;
  const phrase = text.replace(/["“][^"”]+["”]/g, '');
  const days = [...phrase.matchAll(weekday)];
  const qualifiedDay = /\b(?:this|next|last) (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(phrase);
  if (days.length > 1) return null;
  const hasDate = qualifiedDay || explicitDate.test(phrase);
  const date = hasDate ? coworkerLookupDate(phrase, localDay(asOf, timezone)) : null;
  if (hasDate && !date) return null;
  const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });

  const hasKnownTitle = claims.some(({ shift }) => normalize(phrase).includes(normalize(shift.title)));
  return claims.filter(({ shift }) =>
    (!quoted.length || normalize(quoted[0][1]) === normalize(shift.title)) &&
    (!hasKnownTitle || normalize(phrase).includes(normalize(shift.title))) &&
    (!date || localDay(shift.startsAt, timezone) === date) &&
    (hasDate || !days.length || normalize(weekdayFormat.format(new Date(shift.startsAt))) === normalize(days[0][1])));
}

export function createClaimStatus({ card, chat, notice, setBusy, onOutcome }) {
  async function load(text, id) {
    setBusy(true);
    card.replaceChildren();
    card.hidden = true;
    notice('Checking your saved claims…');
    try {
      const response = await requestJSON('/api/worker/requests', { cache: 'no-store' });
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const data = response.data;
      const matches = id ? data.claims.filter(claim => claim.id === id) : matchingClaims(data, text);
      const claim = matches?.length === 1 ? matches[0] : null;
      card.hidden = false;
      let message;
      if (claim) {
        const status = labels[claim.displayStatus] || 'Status unavailable';
        const time = formatShiftTime(claim.shift, data.timezone);
        message = `${claim.shift.title} · ${time.date} · ${status}.`;
        responseHeader(card, status, claim.shift.title);
        card.append(element('p', '', `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' ' : ''}${time.endTime}`));
        if (claim.displayStatus === 'pending') card.append(element('p', '', 'Your manager must approve the claim before you’re assigned.'));
      } else {
        message = matches?.length === 0 ? 'No matching claim found in My requests.' : 'Which claim do you mean?';
        responseHeader(card, 'Saved claims', message);
        const choices = matches ?? data.claims;
        for (const choice of choices.slice(0, 5)) {
          const time = formatShiftTime(choice.shift, data.timezone);
          const button = element('button', 'ai-chat-review', `${choice.shift.title} · ${time.date} · ${time.startTime}`);
          button.type = 'button';
          button.addEventListener('click', () => { if (button.isConnected) void load(text, choice.id); });
          card.append(button);
        }
        if (choices.length > 5) card.append(element('p', '', 'Showing five claims. Narrow by date or open My requests for the full list.'));
      }
      const link = element('a', 'ai-chat-review ai-response-secondary', 'Open My requests');
      link.href = '/workspace/worker/requests';
      card.append(checkedMeta(data.asOf, data.timezone), link);
      onOutcome(message);
      notice(message, true);
      if (id && card.closest('dialog')?.open) link.focus();
    } catch {
      card.hidden = false;
      responseHeader(card, 'Saved claims', 'Couldn’t check your claims', 'uncertain');
      const retry = element('button', 'ai-chat-review', 'Retry claim lookup');
      retry.type = 'button';
      retry.addEventListener('click', () => { if (retry.isConnected) void load(text, id); });
      card.append(retry);
      onOutcome('Couldn’t check your claims. Try again.');
      notice('Couldn’t check your claims. Try again.', true);
    } finally { setBusy(false); }
  }
  return { load };
}
