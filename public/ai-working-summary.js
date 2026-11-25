import { checkedMeta, localDate, responseHeader, responseNote } from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

const labels = {
  approved: 'Approved', rejected: 'Declined', cancelled: 'Cancelled', expired: 'Expired',
};

export function workingSummaryMessage(data) {
  const counts = data.sections.map(({ label, count }) => `${label}: ${count}`).join('. ');
  return `${data.title}. ${localDate(data.startDate)} – ${localDate(data.lastDate)}. ${counts}.`;
}

export function showWorkingSummary(card, data, refresh) {
  card.replaceChildren();
  card.hidden = false;
  responseHeader(card, 'Saved records · Read only', data.title);
  card.append(element('p', 'ai-response-meta', `${localDate(data.startDate)} – ${localDate(data.lastDate)}`));
  const links = new Map();
  for (const group of data.sections) {
    const block = element('section', 'ai-working-summary-section');
    block.append(element('h4', '', `${group.label} · ${group.count}`));
    if (!group.count) block.append(element('p', 'ai-response-meta', 'None in this date window.'));
    for (const row of group.rows) {
      const time = formatShiftTime(row, data.timezone);
      const details = [time.date, `${time.startTime} – ${time.endDate ? time.endDate + ' ' : ''}${time.endTime}`,
        row.relationship, labels[row.status]].filter(Boolean).join(' · ');
      const item = element('div', 'ai-working-summary-item');
      item.append(element('strong', '', row.title), element('p', 'ai-response-meta', details));
      block.append(item);
    }
    if (group.count > group.rows.length) block.append(element('p', 'ai-response-meta', `Showing ${group.rows.length} of ${group.count}.`));
    links.set(group.href, group.linkLabel);
    card.append(block);
  }
  card.append(responseNote('Open requests are for cover on existing shifts. The assigned worker stays responsible until a transfer is approved.', 'neutral'),
    checkedMeta(data.asOf, data.timezone));
  for (const [href, label] of links) {
    const link = element('a', 'ai-chat-review ai-response-secondary', label);
    link.href = href;
    card.append(link);
  }
  const button = element('button', 'ai-chat-review', 'Refresh summary');
  button.type = 'button';
  button.addEventListener('click', refresh);
  card.append(button);
}
