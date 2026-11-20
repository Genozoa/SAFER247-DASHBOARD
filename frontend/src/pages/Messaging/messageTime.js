function format12HourTime(isoStringOrDate) {
  if (!isoStringOrDate) return '';
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}\u00A0${ampm}`;
}

export function formatFullDateTimeTooltip(isoStringOrDate) {
  if (!isoStringOrDate) return '';
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${format12HourTime(d)}`;
}

export function formatDayDividerLabel(isoStringOrDate, now = new Date()) {
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - dMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `TODAY · ${dateFormatted}`;
  }
  if (diffDays === 1) {
    return `YESTERDAY · ${dateFormatted}`;
  }
  if (diffDays > 1 && diffDays < 7) {
    return `${weekdays[d.getDay()]} · ${dateFormatted}`;
  }
  return dateFormatted;
}

export function formatMessageTimestamp(isoStringOrDate, now = new Date()) {
  const d = new Date(isoStringOrDate);
  if (Number.isNaN(d.getTime())) return '';

  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - dMidnight.getTime()) / (1000 * 60 * 60 * 24));
  const time = format12HourTime(d);

  if (diffDays === 0) {
    return time;
  }

  if (diffDays > 0 && diffDays < 7) {
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return `${weekdays[d.getDay()]} at ${time}`;
  }

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${time}`;
}
