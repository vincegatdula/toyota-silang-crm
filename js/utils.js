/* ============================================================
   Toyota CRM — utils.js
   Pure helpers: dates, months, money, DOM, CSV, misc.
   ============================================================ */
(function (global) {
  'use strict';

  const pad2 = (n) => String(n).padStart(2, '0');

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---------- Dates (local timezone, string dates YYYY-MM-DD) ---------- */
  function toDate(iso) {
    if (!iso) return null;
    if (iso instanceof Date) return iso;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function isoOf(d) {
    if (!d) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  const todayISO = () => isoOf(new Date());
  function addDays(iso, n) {
    const d = toDate(iso);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return isoOf(d);
  }
  function diffDays(a, b) {
    const da = toDate(a), db = toDate(b);
    if (!da || !db) return NaN;
    return Math.round((db - da) / 86400000);
  }
  function isPast(iso) {
    if (!iso) return false;
    return diffDays(todayISO(), iso) < 0;
  }
  function isToday(iso) { return iso && iso === todayISO(); }
  function isWeekend(iso) { const d = toDate(iso); return d && (d.getDay() === 0 || d.getDay() === 6); }

  /* ---------- Months ---------- */
  const currentMonthKey = () => todayISO().slice(0, 7);
  function monthKeyOf(iso) { return iso ? String(iso).slice(0, 7) : ''; }
  function addMonths(mk, delta) {
    const [y, m] = String(mk).split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }
  function daysInMonth(mk) {
    const [y, m] = String(mk).split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  const monthLabel = (mk) => {
    if (!mk) return '';
    const [y, m] = String(mk).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  function monthRange(mk) {
    const [y, m] = String(mk).split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return { start: mk + '-01', end: mk + '-' + pad2(days), days };
  }
  function inMonth(iso, mk) { return iso && String(iso).slice(0, 7) === mk; }
  function inRange(iso, start, end) { if (!iso) return false; const d = diffDays(start, iso); return d >= 0 && diffDays(iso, end) >= 0; }

  /* Working-day helpers (Mon–Fri minus holidays). */
  function workingDaysInMonth(mk, holidays) {
    const { start, end, days } = monthRange(mk);
    let wd = 0;
    for (let i = 1; i <= days; i++) {
      const iso = mk + '-' + pad2(i);
      if (isWeekend(iso)) continue;
      if (holidays && holidays.some(h => h.date === iso)) continue;
      wd++;
    }
    return wd;
  }
  function workingDaysLeft(mk, holidays, fromISO) {
    const from = fromISO || todayISO();
    const { end, days } = monthRange(mk);
    let wd = 0;
    const startDay = parseInt(from.slice(8, 10), 10);
    for (let i = startDay; i <= days; i++) {
      const iso = mk + '-' + pad2(i);
      if (isWeekend(iso)) continue;
      if (holidays && holidays.some(h => h.date === iso)) continue;
      wd++;
    }
    return wd;
  }
  const toMonthLabel = (mk) => { const d = new Date(+mk.slice(0,4), +mk.slice(5,7)-1, 1); return d.toLocaleDateString('en-US',{month:'short',year:'numeric'}); };

  /* ---------- Formatting ---------- */
  function fmtDate(iso, opts) {
    const d = toDate(iso);
    if (!d) return '—';
    opts = opts || {};
    return d.toLocaleDateString('en-US', opts.short ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateLong(iso) {
    const d = toDate(iso);
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtMoney(n) {
    if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
    n = Math.round(Number(n));
    return '₱' + n.toLocaleString('en-PH');
  }
  function fmtPct(n) {
    if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  function fmtNum(n, digits) {
    if (n === '' || n === null || n === undefined || isNaN(n)) return '—';
    digits = digits === undefined ? 0 : digits;
    return Number(n).toLocaleString('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  const ucfirst = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  const ensureDate = (iso, fallback) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? String(iso) : (String(iso).match(/^\d{4}-\d{2}-\d{2}/) ? String(iso).slice(0,10) : (fallback || '')));
  const empty = (v) => v === undefined || v === null || String(v).trim() === '';

  /* ---------- Escape / safety ---------- */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Misc ---------- */
  function debounce(fn, ms) {
    let t;
    return function () {
      const self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  }
  function genId(prefix, n) {
    return prefix + String(n).padStart(4, '0');
  }
  function int(v, fallback) {
    v = parseInt(v, 10);
    return isNaN(v) ? (fallback === undefined ? 0 : fallback) : v;
  }

  /* ---------- CSV ---------- */
  function toCSV(rows) {
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const q = (v) => {
      v = (v === null || v === undefined) ? '' : String(v);
      return /["\n,;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [keys.map(q).join(',')];
    rows.forEach(r => lines.push(keys.map(k => q(r[k])).join(',')));
    return '\uFEFF' + lines.join('\r\n');
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: (mime || 'application/octet-stream') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  global.Utils = {
    $, $$, pad2,
    toDate, isoOf, todayISO, addDays, diffDays, isPast, isToday, isWeekend,
    currentMonthKey, monthKeyOf, addMonths, daysInMonth, monthLabel, monthRange, inMonth, inRange,
    workingDaysInMonth, workingDaysLeft, toMonthLabel,
    fmtDate, fmtDateLong, fmtMoney, fmtPct, fmtNum, ucfirst, ensureDate, empty,
    esc, debounce, genId, int, toCSV, download
  };
})(window);