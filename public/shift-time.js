function dateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
export function formatShiftTime(shift, timezone) {
  const start = new Date(shift.startsAt);
  const end = new Date(shift.endsAt);
  const format = (date, options) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...options }).format(date);
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' };
  const minutes = (end - start) / 60000;
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remaining = roundedMinutes % 60;
  const duration = minutes < 1 ? 'Less than 1 minute' : [
    hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    remaining ? `${remaining} ${remaining === 1 ? 'minute' : 'minutes'}` : '',
  ].filter(Boolean).join(' ');
  return {
    date: format(start, dateOptions),
    weekday: format(start, { weekday: 'short' }),
    day: format(start, { day: 'numeric' }),
    startTime: format(start, timeOptions),
    endTime: format(end, timeOptions),
    endDate: dateKey(start, timezone) === dateKey(end, timezone) ? null : format(end, dateOptions),
    duration,
    hours: minutes / 60,
  };
}
