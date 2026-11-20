import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDayDividerLabel, formatMessageTimestamp } from '../src/pages/Messaging/messageTime.js';

const now = new Date(2026, 10, 17, 12, 0);
const sentAt = (daysAgo, hour = 9, minute = 5) => new Date(2026, 10, 17 - daysAgo, hour, minute);

test('message timestamps use time, weekday, then full date by calendar age', () => {
  assert.equal(formatMessageTimestamp(sentAt(0), now), '9:05\u00A0AM');
  assert.equal(formatMessageTimestamp(sentAt(1), now), 'MON at 9:05\u00A0AM');
  assert.equal(formatMessageTimestamp(sentAt(6), now), 'WED at 9:05\u00A0AM');
  assert.equal(formatMessageTimestamp(sentAt(7), now), 'NOV 10, 2026 at 9:05\u00A0AM');
});

test('message date dividers update for today, yesterday, this week, and older dates', () => {
  assert.equal(formatDayDividerLabel(sentAt(0), now), 'TODAY · 17 NOV 2026');
  assert.equal(formatDayDividerLabel(sentAt(1), now), 'YESTERDAY · 16 NOV 2026');
  assert.equal(formatDayDividerLabel(sentAt(2), now), 'SUN · 15 NOV 2026');
  assert.equal(formatDayDividerLabel(sentAt(7), now), '10 NOV 2026');
});
