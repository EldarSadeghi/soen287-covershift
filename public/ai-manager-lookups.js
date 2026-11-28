import { coworkerLookupDate } from './ai-chat-routing.js';
import { checkedMeta, localDate, responseHeader } from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import {
  INSIGHT_KINDS,
  insightQuery,
  renderInsight,
} from './ai-manager-insights.js';
import { renderReplacements, replacementQuery } from './ai-replacements.js';

const views = {
  teamTimeOff: [
    'Team time off',
    'time-off',
    'Open Time off',
    'No approved or pending time off in this date range.',
  ],
  coverageStatus: [
    'Coverage status',
    'approvals',
    'Open Approvals',
    'No open, pending or approved coverage matched this lookup.',
  ],
  publicationStatus: ['Schedule publication', 'schedule', 'Open Schedule', ''],
};
const status = {
  open: 'Open',
  pending: 'Claimed · Awaiting approval',
  approved: 'Covered',
};

export function managerLookupQuery(
  kind,
  text,
  today,
  dateReply = null,
  priorDate = null,
) {
  if (kind === 'replacements')
    return replacementQuery(text, today, dateReply, priorDate);
  if (INSIGHT_KINDS.includes(kind))
    return insightQuery(kind, text, today, dateReply);
  const params = { kind };
  const quoted = text.match(/["“]([^"”]+)["”]/);
  const named = /^\s*(?:is|was) (.+?) covered\b/i
    .exec(text)?.[1]
    ?.split(/\s+on\s+/i)[0];
  const claimantSubject =
    /^\s*who (?:claimed|covered|is covering) (.+?)[?!.]*$/i.exec(text)?.[1];
  const claimTitle = claimantSubject?.split(/\s+on\s+/i)[0];
  const title =
    kind === 'coverageStatus' &&
    (quoted?.[1] ||
      (named &&
        !/^(?:(?:the|a|this|that|my) )?(?:shift|shifts|coverage|request|it)$/i.test(
          named,
        ) &&
        named) ||
      (claimTitle &&
        !coworkerLookupDate(claimTitle, today) &&
        !/^(?:(?:the|a|this|that) )?(?:shift|shifts|coverage|request|it)$/i.test(
          claimTitle,
        ) &&
        claimTitle));
  if (title) params.title = title;
  const dateText = title ? text.replace(quoted?.[0] || title, '') : text;
  const parts = dateText.split(/\s+(?:through|until|to|–|—)\s+/i);
  const from = coworkerLookupDate(parts[0], today);
  const through = parts.length === 2 && coworkerLookupDate(parts[1], today);
  if (
    parts.length > 1 &&
    (!from || !through || through < from || kind !== 'teamTimeOff')
  ) {
    return {
      question:
        kind === 'teamTimeOff'
          ? 'Which date range should I check? Give two dates in order, such as December 3 through December 5.'
          : 'Which date should I check? Give one date, such as December 3.',
    };
  }
  if (from) params.from = from;
  if (through) params.through = through;
  if (
    from ||
    title ||
    (kind === 'publicationStatus' &&
      /\b(?:next|upcoming) (?:two weeks|schedule|(?:schedule )?period|rota)\b/i.test(
        text,
      ))
  )
    return { params };
  return {
    question: 'Which date should I check? Give a date such as December 3.',
  };
}

// Structured fallback values are only used by the existing read-only routes.
export function classifiedManagerLookup(kind, text, today, details) {
  const query = managerLookupQuery(kind, text, today);
  if (
    !details ||
    !['coverageStatus', 'shiftHistory', 'replacements', 'teamTimeOff'].includes(
      kind,
    )
  )
    return query;
  const from = details.date ?? query.params?.from;
  const title = details.title ?? query.params?.title;
  if (!from && !(kind === 'coverageStatus' && title)) return query;
  const params = { ...query.params, kind };
  if (from) params.from = from;
  if (details.through) params.through = details.through;
  else if (details.date && kind !== 'teamTimeOff') params.through = from;
  if (title) params.title = title;
  if (kind === 'replacements' && details.person) params.worker = details.person;
  return { params };
}

export function renderManagerLookup(card, data) {
  if (data.kind === 'replacements') return renderReplacements(card, data);
  if (INSIGHT_KINDS.includes(data.kind)) return renderInsight(card, data);
  const [label, page, linkLabel, empty] = views[data.kind];
  const dateRange = data.from
    ? [data.from, ...(data.through !== data.from ? [data.through] : [])]
        .map(localDate)
        .join(' – ')
    : '';
  const scope = [
    data.title || 'Entire team',
    dateRange || 'All matching dates',
  ].join(' · ');
  card.replaceChildren();
  responseHeader(card, 'Saved records · Read only', label);
  card.append(element('p', 'ai-response-meta', scope));

  let reply;
  if (data.kind === 'publicationStatus') {
    const publication = data.publishedAt ? 'Published' : 'Awaiting publication';
    const due =
      data.dueStatus === 'overdue' ? 'Overdue since' : 'Publication due';
    reply = `${publication}. ${data.unpublished} unpublished shift ${data.unpublished === 1 ? 'change' : 'changes'}. ${due} ${localDate(data.dueOn)}.`;
    card.append(element('p', '', reply));
  } else {
    const { rows } = data;
    if (!rows.length) {
      reply = empty;
      card.append(element('p', '', reply));
    } else {
      const pending = rows.filter((row) => row.status === 'pending').length;
      reply =
        data.kind === 'teamTimeOff'
          ? `${rows.length - pending} approved time-off records and ${pending} awaiting review.`
          : `${rows.length} matching coverage records.`;
      for (const row of rows) {
        const when = formatShiftTime(row, data.timezone);
        const time = row.allDay
          ? `${when.date}${when.endDate ? ' · through ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: data.timezone }).format(Date.parse(row.endsAt) - 1) : ''} · All day`
          : `${when.date} · ${when.startTime} – ${when.endDate ? when.endDate + ' · ' : ''}${when.endTime}`;
        const heading =
          data.kind === 'teamTimeOff' ? row.workerName : row.title;
        const state =
          data.kind === 'teamTimeOff'
            ? row.status === 'approved'
              ? 'Approved time off'
              : 'Pending review'
            : [status[row.status], row.workerName].filter(Boolean).join(' · ');
        card.append(
          element('h4', '', heading),
          element('p', '', state),
          element('p', 'ai-response-meta', time),
        );
      }
    }
  }
  const link = element('a', 'ai-chat-review', linkLabel);
  link.href = '/workspace/manager/' + page;
  card.append(checkedMeta(data.asOf, data.timezone), link);
  return reply;
}
