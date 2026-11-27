import {
  checkedMeta,
  localDate,
  responseHeader,
  responseStats,
} from './ai-response-card.js';
import { element } from './shift-card.js';

const statuses = {
  approved: 'Approved',
  pending: 'Awaiting approval',
  open: 'Open',
  rejected: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function sourceLink(label, href, primary = false) {
  const link = element('a', primary ? 'ai-chat-review' : '', label);
  link.href = href;
  return link;
}

export function renderEmployeeLookup(card, data) {
  card.replaceChildren();
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone: data.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (data.kind === 'history') {
    const period = [localDate(data.from), localDate(data.through)].join(' – ');
    responseHeader(card, 'Saved records · Read only', 'Your coverage history');
    card.append(
      element('p', 'ai-response-meta', `${period} · Based on shift dates`),
    );
    const { pickedUp, givenAway, pending, declinedOrExpired } = data.counts;
    if (data.total) {
      card.append(
        responseStats([
          [pickedUp, 'Picked up'],
          [givenAway, 'Given away'],
          [pending, 'Still pending'],
          [declinedOrExpired, 'Declined or expired'],
        ]),
      );
      for (const row of data.rows) {
        const item = element('section', 'ai-working-summary-section');
        item.append(
          element('h4', '', row.title),
          element(
            'p',
            'ai-response-meta',
            `${formatter.format(new Date(row.startsAt))} · ${row.relation === 'claim' ? 'Your claim' : 'Your request'} · ${statuses[row.status]}`,
          ),
        );
        card.append(item);
      }
      if (data.total > data.rows.length)
        card.append(
          element(
            'p',
            'ai-response-meta',
            `Showing the latest ${data.rows.length} of ${data.total} records.`,
          ),
        );
    }
    const reply = data.total
      ? `${pickedUp} picked up, ${givenAway} given away, ${pending} still pending, and ${declinedOrExpired} declined or expired.`
      : 'No coverage history in this period.';
    if (!data.total) card.append(element('p', '', reply));
    card.append(
      checkedMeta(data.asOf, data.timezone),
      sourceLink('Open History', '/workspace/worker/history', true),
    );
    return reply;
  }

  responseHeader(card, 'Saved notifications · Read only', 'Your updates');
  const reply = data.unreadCount
    ? `${data.unreadCount} unread ${data.unreadCount === 1 ? 'update' : 'updates'}.`
    : data.rows.length
      ? 'You’re caught up. Here are your most recent updates.'
      : 'There are no updates yet.';
  card.append(element('p', '', reply));
  for (const row of data.rows) {
    const item = element('section', 'ai-working-summary-section');
    item.append(
      element('h4', '', row.headline),
      element('p', '', row.title),
      element('p', '', row.message),
      element(
        'p',
        'ai-response-meta',
        formatter.format(new Date(row.createdAt)),
      ),
      sourceLink(row.linkLabel || 'View related item', row.href),
    );
    card.append(item);
  }
  card.append(checkedMeta(data.asOf, data.timezone));
  return reply;
}
