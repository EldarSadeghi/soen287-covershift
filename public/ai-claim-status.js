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

export function createClaimStatus(view) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/requests', list: data => data.claims,
    singular: 'claim', plural: 'claims', heading: 'Saved claims',
    status: claim => labels[claim.displayStatus],
    detail: claim => claim.displayStatus === 'pending' ? 'Your manager must approve the claim before you’re assigned.' : null,
    link: () => '/workspace/worker/requests', linkLabel: 'Open My requests',
  });
}

export function outgoingCoverInvitations(data, userId) {
  return data.invitations.filter(invitation => invitation.senderId === userId);
}

const coverLabels = {
  pending: 'Waiting for coworker response', awaiting_approval: 'Awaiting manager approval',
  approved: 'Approved', rejected: 'Rejected by manager', declined: 'Declined by coworker',
  cancelled: 'Cancelled', expired: 'Expired',
};

export function createCoverStatus(view, userId) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/cover-invitations', list: data => outgoingCoverInvitations(data, userId),
    singular: 'cover invitation', plural: 'cover invitations', heading: 'Sent cover invitations',
    status: invitation => coverLabels[invitation.status],
    recipient: invitation => invitation.recipientName,
    detail: invitation => invitation.status === 'awaiting_approval'
      ? 'Your coworker accepted. You remain assigned until a manager approves the change.'
      : invitation.status === 'pending' ? 'Your coworker has not responded yet.' : null,
    link: invitation => '/workspace/worker/cover' + (invitation ? '?invitation=' + encodeURIComponent(invitation.id) : ''),
    linkLabel: 'Open Cover requests',
  });
}

function createStatusLookup({ card, chat, notice, setBusy, onOutcome }, config) {
  async function load(text, id) {
    setBusy(true);
    card.replaceChildren();
    card.hidden = true;
    notice(`Checking your ${config.plural}…`);
    try {
      const response = await requestJSON(config.endpoint, { cache: 'no-store' });
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const data = response.data;
      const claims = config.list(data);
      const matches = id ? claims.filter(claim => claim.id === id) : matchingClaims({ ...data, claims }, text);
      const claim = matches?.length === 1 ? matches[0] : null;
      card.hidden = false;
      let message;
      if (claim) {
        const recipient = config.recipient?.(claim);
        const status = config.status(claim) || 'Status unavailable';
        const time = formatShiftTime(claim.shift, data.timezone);
        message = `${claim.shift.title} · ${time.date} · ${status}.`;
        responseHeader(card, status, claim.shift.title);
        card.append(element('p', '', `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' ' : ''}${time.endTime}`));
        if (recipient) card.append(element('p', '', `Sent to ${recipient}`));
        const detail = config.detail(claim);
        if (detail) card.append(element('p', '', detail));
      } else {
        message = matches?.length === 0 ? `No matching ${config.singular} found.` : `Which ${config.singular} do you mean?`;
        responseHeader(card, config.heading, message);
        const choices = matches ?? claims;
        for (const choice of choices.slice(0, 5)) {
          const time = formatShiftTime(choice.shift, data.timezone);
          const recipient = config.recipient?.(choice);
          const label = [choice.shift.title, time.date, time.startTime, recipient].filter(Boolean).join(' · ');
          const button = element('button', 'ai-chat-review', label);
          button.type = 'button';
          button.addEventListener('click', () => { if (button.isConnected) void load(text, choice.id); });
          card.append(button);
        }
        if (choices.length > 5) card.append(element('p', '', `Showing five ${config.plural}. Narrow by date or open the full list.`));
      }
      const link = element('a', 'ai-chat-review ai-response-secondary', config.linkLabel);
      link.href = config.link(claim);
      card.append(checkedMeta(data.asOf, data.timezone), link);
      onOutcome(message);
      notice(message, true);
      if (id && card.closest('dialog')?.open) link.focus();
    } catch {
      card.hidden = false;
      responseHeader(card, config.heading, `Couldn’t check your ${config.plural}`, 'uncertain');
      const retry = element('button', 'ai-chat-review', `Retry ${config.singular} lookup`);
      retry.type = 'button';
      retry.addEventListener('click', () => { if (retry.isConnected) void load(text, id); });
      card.append(retry);
      onOutcome(`Couldn’t check your ${config.plural}. Try again.`);
      notice(`Couldn’t check your ${config.plural}. Try again.`, true);
    } finally { setBusy(false); }
  }
  return { load };
}
