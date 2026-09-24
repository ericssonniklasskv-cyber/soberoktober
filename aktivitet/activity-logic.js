(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ActivityLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const relative = new Intl.RelativeTimeFormat('sv', { numeric: 'auto' });

  function relativeTime(value, now = Date.now()) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return '';
    const seconds = Math.round((timestamp - now) / 1000);
    if (Math.abs(seconds) < 60) return relative.format(seconds, 'second');
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 7) return relative.format(days, 'day');
    return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' }).format(new Date(timestamp));
  }

  function sentence(item) {
    const name = String(item.display_name || 'Deltagare').trim() || 'Deltagare';
    const level = Number(item.multiplier);
    if (![1, 2, 3].includes(level)) return '';
    return item.activity_type === 'upgraded'
      ? `${name} uppgraderade till ×${level}`
      : `${name} klarade dagens pass ×${level}`;
  }

  function fullTimestamp(value) {
    const timestamp = new Date(value);
    if (!Number.isFinite(timestamp.getTime())) return '';
    return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeStyle: 'short' }).format(timestamp);
  }

  return { relativeTime, sentence, fullTimestamp };
});
