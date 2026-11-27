import { coworkerLookupDate, isStatusDateFollowUp } from './ai-chat-routing.js';
import { checkedMeta, responseHeader } from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { timeOffRange } from './time-off.js';
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
  const filter = statusDateFilter(phrase, asOf, timezone);
  if (!filter) return null;

  const hasKnownTitle = claims.some(({ shift }) => normalize(phrase).includes(normalize(shift.title)));
  return claims.filter(({ shift }) =>
    (!quoted.length || normalize(quoted[0][1]) === normalize(shift.title)) &&
    (!hasKnownTitle || normalize(phrase).includes(normalize(shift.title))) &&
    filter(localDay(shift.startsAt, timezone)));
}

function statusDateFilter(text, asOf, timezone) {
  const days = [...text.matchAll(weekday)];
  if (days.length > 1) return null;
  const qualified = /\b(?:this|next|last) (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(text);
  if (qualified || explicitDate.test(text)) {
    const date = coworkerLookupDate(text, localDay(asOf, timezone));
    return date ? (start, end = start) => start <= date && date <= end : null;
  }
  if (!days.length) return () => true;
  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(normalize(days[0][1]));
  return (start, end = start) => {
    const first = new Date(start + 'T00:00:00Z');
    first.setUTCDate(first.getUTCDate() + (dayIndex - first.getUTCDay() + 7) % 7);
    return first.toISOString().slice(0, 10) <= end;
  };
}

export function matchingTimeOff({ requests, timezone, asOf }, text) {
  const filter = statusDateFilter(text, asOf, timezone);
  return filter && requests.filter(request => filter(
    localDay(request.startsAt, request.timezone || timezone),
    localDay(Date.parse(request.endsAt) - 1, request.timezone || timezone),
  ));
}

export function createTimeOffStatus(view) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/time-off', list: data => data.requests,
    match: (data, text) => matchingTimeOff(data, text),
    singular: 'time-off request', plural: 'time-off requests', heading: 'Your time-off requests',
    format: request => ({ title: 'Time-off request', range: timeOffRange(request) }),
    status: request => labels[request.status],
    detail: request => request.status === 'pending' ? 'Your schedule stays the same until a manager approves the request.' : null,
    link: request => '/workspace/worker/time-off' + (request ? '?request=' + encodeURIComponent(request.id) : ''),
    linkLabel: 'Open Time off',
  });
}

export function formatStatusShift(record, timezone) {
  const time = formatShiftTime(record.shift, timezone);
  return {
    title: record.shift.title,
    range: `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' ' : ''}${time.endTime}`,
  };
}

export function createClaimStatus(view) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/requests', list: data => data.claims, format: formatStatusShift,
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
    endpoint: '/api/worker/cover-invitations', format: formatStatusShift, list: data => outgoingCoverInvitations(data, userId),
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

export function typedStatusChoice(text, choices, data, match = matchingClaims) {
  const reply = normalize(text).replace(/[.!?]+$/, '');
  const ordinal = /^(?:the )?(first|second|third|fourth|fifth|[1-5])(?: (?:one|request|claim|invitation))?$/.exec(reply);
  if (ordinal) {
    const words = ['first', 'second', 'third', 'fourth', 'fifth'];
    const position = Number(ordinal[1]) || words.indexOf(ordinal[1]) + 1;
    return choices[position - 1]?.id ?? null;
  }

  const part = reply.match(/\b(morning|afternoon|evening)\b/g) || [];
  if (part.length > 1) return null;
  const date = reply.replace(/^(?:(?:what|how) about |the |on |for )+/, '')
    .replace(/\s+(?:one|request|claim|invitation)$/, '')
    .replace(/\b(?:morning|afternoon|evening)\b/, '').trim();
  if (date && !isStatusDateFollowUp(date)) return null;
  if (!date && !part.length) return null;

  const narrowed = date ? match({ ...data, claims: choices, requests: choices }, date) : choices;
  const matches = narrowed?.filter(choice => {
    if (!part.length) return true;
    if (choice.allDay) return false;
    const hour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: choice.timezone || data.timezone, hour: 'numeric', hourCycle: 'h23',
    }).format(new Date((choice.shift || choice).startsAt)));
    return part[0] === (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');
  });
  return matches?.length === 1 ? matches[0].id : null;
}

// Also used by the follow-through lookups (CS-067), which add `fetch` (several
// lists in one), `empty` (nothing to act on) and `action` (a link that opens the
// item's existing confirmation; nothing is saved from chat).
export function createStatusLookup({ card, chat, notice, setBusy, onOutcome }, config) {
  let picker;
  async function load(text, id) {
    picker = null;
    setBusy(true);
    card.replaceChildren();
    card.hidden = true;
    notice(`Checking your ${config.plural}…`);
    try {
      const response = config.fetch ? await config.fetch(text) : await requestJSON(config.endpoint, { cache: 'no-store' });
      if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const data = response.data;
      const claims = config.list(data);
      const matches = id ? claims.filter(claim => claim.id === id) : (config.match || matchingClaims)({ ...data, claims }, text);
      const claim = matches?.length === 1 ? matches[0] : null;
      card.hidden = false;
      let message;
      const action = claim && config.action ? config.action(claim, text, data) : null;
      if (!claims.length && config.empty) {
        message = config.empty(data, text);
        responseHeader(card, config.heading, message);
      } else if (action) {
        message = action.message;
        const { title, range } = config.format(claim, data.timezone);
        responseHeader(card, action.status, title);
        card.append(element('p', '', range));
        for (const line of action.details) card.append(element('p', '', line));
      } else if (claim) {
        const recipient = config.recipient?.(claim);
        const status = config.status(claim) || 'Status unavailable';
        const { title, range } = config.format(claim, data.timezone);
        message = `${title} · ${range} · ${status}.`;
        responseHeader(card, status, title);
        card.append(element('p', '', range));
        if (recipient) card.append(element('p', '', `Sent to ${recipient}`));
        const detail = config.detail(claim);
        if (detail) card.append(element('p', '', detail));
      } else {
        message = matches?.length === 0 ? `No matching ${config.singular} found.` : `Which ${config.singular} do you mean?`;
        responseHeader(card, config.heading, message);
        const choices = matches ?? claims;
        const visible = choices.slice(0, 5);
        for (const [index, choice] of visible.entries()) {
          const { title, range } = config.format(choice, data.timezone);
          const recipient = config.recipient?.(choice);
          const label = [title, range, recipient].filter(Boolean).join(' · ');
          const button = element('button', 'ai-chat-review', `${index + 1}. ${label}`);
          if (index === 0) picker = { anchor: button, choices: visible, data, text };
          button.type = 'button';
          button.addEventListener('click', () => { if (button.isConnected) void load(text, choice.id); });
          card.append(button);
        }
        if (choices.length > 5) card.append(element('p', '', `Showing five ${config.plural}. Narrow by date or open the full list.`));
      }
      const link = element('a', action?.href ? 'ai-chat-review' : 'ai-chat-review ai-response-secondary', action?.label || config.linkLabel);
      link.href = action?.href || config.link(claim);
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
  return {
    load,
    choiceReply(text) {
      if (!picker?.anchor.isConnected || card.hidden) return undefined;
      return typedStatusChoice(text, picker.choices, picker.data, config.match);
    },
    loadChoice(id) { return load(picker.text, id); },
  };
}
