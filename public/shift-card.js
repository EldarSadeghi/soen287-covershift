import { formatShiftTime } from './shift-time.js';
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function shiftCard(shift, timezone, { workerName = null } = {}) {
  const formatted = formatShiftTime(shift, timezone);
  const article = element('article', 'shift saved-shift');
  const calendar = element('div', 'calendar'); calendar.setAttribute('aria-hidden', 'true');
  calendar.append(element('small', '', formatted.weekday), element('strong', '', formatted.day));
  const info = element('div', 'shift-info');
  info.append(element('p', 'saved-shift-date', formatted.date), element('h3', '', shift.title));
  const times = element('p', 'saved-shift-times');
  const start = element('time', '', formatted.startTime); start.dateTime = shift.startsAt;
  const end = element('time', '', formatted.endDate ? `${formatted.endDate} · ${formatted.endTime}` : formatted.endTime); end.dateTime = shift.endsAt;
  times.append(start, document.createTextNode(' – '), end);
  info.append(times, element('p', '', formatted.duration));
  if (workerName) info.append(element('p', 'assigned-worker', `Assigned to ${workerName}`));
  const status = shift.status === 'in_progress' ? 'In progress' : shift.status === 'completed' ? 'Shift ended' : 'Upcoming';
  const badge = element('span', `badge${shift.status === 'upcoming' ? '' : ' amber'}`, status);
  article.append(calendar, info, badge); return article;
}
