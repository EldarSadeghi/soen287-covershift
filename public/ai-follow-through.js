// Employee follow-through on their own requests in chat (CS-067): answer a
// cover invitation, cancel a cover request or invitation they sent, or cancel
// time off. The chat only finds the item; its link opens the existing
// confirmation on Cover requests, My requests or Time off, where the employee
// confirms. Nothing is saved from chat.
import { invitationAnswer } from './routing/employee.js';
import {
  createStatusLookup,
  formatStatusShift,
  matchingClaims,
  matchingTimeOff,
} from './ai-claim-status.js';
import { nameAt } from './ai-replacements.js';
import { requestJSON } from './request.js';
import { timeOffRange } from './time-off.js';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_WORD =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b20\d{2}-\d{2}-\d{2}\b/i;

function localDay(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day']
    .map((key) => parts.find((part) => part.type === key).value)
    .join('-');
}

// "the 24th" with no month means the next 24th, this month or next.
export function withMonth(text, today) {
  if (MONTH_WORD.test(text)) return text;
  return text.replace(
    /\b(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i,
    (whole, number) => {
      const day = Number(number);
      if (day < 1 || day > 31) return whole;
      const month =
        Number(today.slice(5, 7)) -
        1 +
        (day < Number(today.slice(8, 10)) ? 1 : 0);
      return `${MONTHS[month % 12]} ${day}`;
    },
  );
}

// The coworker the message names: "Alex asked me", "Jamie's invite",
// "the request from sam rivera", "the invitation I sent to Taylor".
export function namedCoworker(text) {
  const lead =
    /^(?:(?:so|ok(?:ay)?|hey),?\s+)?(.+?)\s+(?:asked|invited)\s+me\b/i.exec(
      text.trim(),
    );
  if (lead) {
    const name = nameAt(lead[1], 'person');
    if (name && name.split(/\s+/).length === lead[1].trim().split(/\s+/).length)
      return name;
  }
  // Read names after the command verb, so "decline jamie's invite" is Jamie.
  const object = text.replace(
    /^.*?\b(?:accept|decline|reject|turn down|say (?:yes|no) to|cancel|withdraw|take back|retract|call off)\s+/i,
    '',
  );
  for (const match of object.matchAll(
    /\b(\S+(?:\s+\S+)?)\s+(?:cover\s+|swap\s+)?(?:invite|invitation|request|cover request|swap request)s?\b/gi,
  )) {
    const owner = /(?:^|\s)(\S+?(?:\s+\S+?)?['’]s)$/i.exec(match[1].trim());
    const name = owner && nameAt(owner[1], 'possessive');
    if (name) return name;
  }
  const after = /\b(?:from|sent to|to|by)\s+(.+)$/i.exec(
    text.replace(/\b(?:asked|invited) me to\b.*$/i, ''),
  );
  return (after && nameAt(after[1], 'person')) || null;
}

// Narrows to records whose coworker has that name; never falls back to others.
function byPerson(records, text, person) {
  const wanted = namedCoworker(text)?.toLocaleLowerCase();
  if (!wanted) return records;
  return records.filter((record) => {
    const name = (person(record) || '').toLocaleLowerCase();
    return (
      name === wanted ||
      (!wanted.includes(' ') && name.split(/\s+/).includes(wanted))
    );
  });
}

function shiftMatches(person) {
  return (data, text) => {
    const today = localDay(data.asOf, data.timezone);
    const dated = matchingClaims(data, withMonth(text, today));
    return dated && byPerson(dated, text, person);
  };
}

const pageLink = (path, key, id, action) =>
  `${path}?${key}=${encodeURIComponent(id)}&action=${action}`;

export function createInviteAnswer(view, userId) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/cover-invitations',
    list: (data) =>
      data.invitations.filter(
        (invite) => invite.recipientId === userId && invite.canAccept,
      ),
    match: shiftMatches((invite) => invite.senderName),
    format: formatStatusShift,
    singular: 'invitation',
    plural: 'cover invitations',
    heading: 'Cover invitations for you',
    status: () => 'Waiting for your answer',
    recipient: (invite) => `From ${invite.senderName}`,
    detail: () => null,
    empty: () => 'You have no cover invitations waiting for your answer.',
    action: (invite, text, data) => {
      const answer = invitationAnswer(text);
      const { title, range } = formatStatusShift(invite, data.timezone);
      const from = `From ${invite.senderName}`;
      if (!answer)
        return {
          status: 'Waiting for your answer',
          label: 'Open to accept or decline',
          href:
            '/workspace/worker/cover?invitation=' +
            encodeURIComponent(invite.id),
          details: [from, 'Accept or decline it on Cover requests.'],
          message: `${title} · ${range} · ${from}. Accept or decline it on Cover requests.`,
        };
      const accept = answer === 'accept';
      return {
        status: accept ? 'Ready to accept' : 'Ready to decline',
        label: accept ? 'Review and accept' : 'Review and decline',
        href: pageLink(
          '/workspace/worker/cover',
          'invitation',
          invite.id,
          answer,
        ),
        details: [
          from,
          accept
            ? 'Accepting sends it to your manager for approval. You aren’t assigned until they approve.'
            : `Declining lets ${invite.senderName} know. No shift changes.`,
        ],
        message: `Ready to ${answer} ${title} · ${range} · ${from}. Confirm it on Cover requests.`,
      };
    },
    link: () => '/workspace/worker/cover',
    linkLabel: 'Open Cover requests',
  });
}

// Cover requests the employee created (My requests), invitations they sent
// (Cover requests) and, when they say "claim", claims they made, which can't
// be withdrawn and get an honest answer instead.
async function cancellableCover(userId, text) {
  const [requests, invitations] = await Promise.all([
    requestJSON('/api/worker/requests', { cache: 'no-store' }),
    requestJSON('/api/worker/cover-invitations', { cache: 'no-store' }),
  ]);
  const failed = [requests, invitations].find((response) => !response.ok);
  if (failed) return failed;
  const mentionsClaim = /\bclaim/i.test(text);
  const items = [
    ...requests.data.requests
      .filter((request) => request.canCancel)
      .map((request) => ({
        ...request,
        kind: 'request',
        person: request.claimantName,
      })),
    ...invitations.data.invitations
      .filter((invite) => invite.senderId === userId && invite.canCancel)
      .map((invite) => ({
        ...invite,
        kind: 'invitation',
        person: invite.recipientName,
      })),
    ...(mentionsClaim
      ? requests.data.claims
          .filter((claim) => claim.displayStatus === 'pending')
          .map((claim) => ({
            ...claim,
            kind: 'claim',
            person: claim.originalWorkerName,
          }))
      : []),
  ].sort(
    (a, b) =>
      a.shift.startsAt.localeCompare(b.shift.startsAt) ||
      a.id.localeCompare(b.id),
  );
  return {
    ok: true,
    status: 200,
    data: { items, timezone: requests.data.timezone, asOf: requests.data.asOf },
  };
}

export function createCancelCover(view, userId) {
  return createStatusLookup(view, {
    fetch: (text) => cancellableCover(userId, text),
    list: (data) => data.items,
    match: shiftMatches((item) => item.person),
    format: formatStatusShift,
    singular: 'request',
    plural: 'requests',
    heading: 'Requests you can cancel',
    status: () => null,
    recipient: (item) =>
      item.kind === 'invitation'
        ? `Invitation to ${item.person}`
        : item.kind === 'claim'
          ? `Your claim on ${item.person}’s shift`
          : item.status === 'pending'
            ? `Cover request · claimed by ${item.person || 'a teammate'}`
            : 'Cover request · open',
    detail: () => null,
    empty: () => 'You have no pending cover requests or invitations to cancel.',
    action: (item, text, data) => {
      const { title, range } = formatStatusShift(item, data.timezone);
      if (item.kind === 'claim')
        return {
          status: 'Can’t be withdrawn here',
          label: 'Open My requests',
          href: '/workspace/worker/requests',
          details: [
            `Your claim on ${item.person}’s shift is waiting for manager approval.`,
            'CoverShift doesn’t let you withdraw a claim. Your manager decides it, so ask them if you can no longer take the shift.',
          ],
          message: `Your claim on ${title} · ${range} can’t be withdrawn in CoverShift. Your manager decides it.`,
        };
      const invite = item.kind === 'invitation';
      return {
        status: 'Ready to cancel',
        label: 'Review cancellation',
        href: invite
          ? pageLink('/workspace/worker/cover', 'invitation', item.id, 'cancel')
          : pageLink(
              '/workspace/worker/requests',
              'request',
              item.id,
              'cancel',
            ),
        details: [
          invite
            ? `Invitation to ${item.person}, waiting for their answer.`
            : item.status === 'pending'
              ? `Claimed by ${item.person || 'a teammate'}, waiting for manager approval.`
              : 'Open for a teammate to claim.',
          'You stay assigned to the shift. The record is kept.',
        ],
        message: `Ready to cancel your ${invite ? 'invitation' : 'cover request'} for ${title} · ${range}. Confirm it on ${invite ? 'Cover requests' : 'My requests'}.`,
      };
    },
    link: () => '/workspace/worker/requests',
    linkLabel: 'Open My requests',
  });
}

const leaveLabels = {
  pending: 'Pending manager approval',
  approved: 'Approved',
};

export function createCancelTimeOff(view) {
  return createStatusLookup(view, {
    endpoint: '/api/worker/time-off',
    list: (data) => data.requests.filter((request) => request.canCancel),
    match: (data, text) =>
      matchingTimeOff(
        data,
        withMonth(text, localDay(data.asOf, data.timezone)),
      ),
    format: (request) => ({
      title: 'Time-off request',
      range: timeOffRange(request),
    }),
    singular: 'time-off request',
    plural: 'time-off requests',
    heading: 'Time off you can cancel',
    status: (request) => leaveLabels[request.status],
    detail: () => null,
    empty: () =>
      'You have no upcoming time-off requests to cancel. Only pending or approved time off that hasn’t started can be cancelled.',
    action: (request) => ({
      status: 'Ready to cancel',
      label: 'Review cancellation',
      href: pageLink(
        '/workspace/worker/time-off',
        'request',
        request.id,
        'cancel',
      ),
      details: [leaveLabels[request.status], 'Your shifts stay as they are.'],
      message: `Ready to cancel your time off for ${timeOffRange(request)} (${leaveLabels[request.status].toLowerCase()}). Confirm it on Time off.`,
    }),
    link: () => '/workspace/worker/time-off',
    linkLabel: 'Open Time off',
  });
}
