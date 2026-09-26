/* ============================================================
   Toyota CRM — calendar.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 14);

  const TYPE = {
    followup: 'Follow-up', activity: 'Activity', testdrive: 'Test Drive', meeting: 'Meeting',
    financing: 'Financing', reservation: 'Reservation', payment: 'Payment', release: 'Release',
    birthday: 'Birthday', anniv: 'Anniversary', holiday: 'Holiday'
  };
  const TYPE_CLS = {
    followup: 'ev-c-followup', activity: 'ev-c-activity', testdrive: 'ev-c-testdrive',
    meeting: 'ev-c-meeting', financing: 'ev-c-financing', reservation: 'ev-c-reservation',
    payment: 'ev-c-payment', release: 'ev-c-release', birthday: 'ev-c-birthday',
    anniv: 'ev-c-anniv', holiday: 'ev-c-holiday'
  };

  function buildEvents(leads, acts, holidays, mk) {
    const events = [];
    const year = parseInt(mk.slice(0, 4), 10);
    const add = (date, type, title, leadId, meta) => {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return;
      events.push({ date, type, cls: TYPE_CLS[type], t: type, title, leadId, meta: meta || '' });
    };

    (holidays || []).forEach(h => { if (h && h.date) add(h.date, 'holiday', h.name || 'Holiday', null, h.date); });

    leads.forEach(l => {
      if (l.archived) return;
      const name = LeadView.customerName(l);
      const veh = LeadView.vehicleLabel(l);
      add(l.nextFollowupDate && !db.leads.isReleased(l) && l.status !== 'Lost' ? l.nextFollowupDate : '', 'followup', 'Follow-up: ' + name + (veh !== '—' ? ' (' + veh + ')' : ''), l.id, l.nextStep);
      add(l.testDriveDate ? l.testDriveDate : '', 'testdrive', 'Test Drive: ' + name + (veh !== '—' ? ' (' + veh + ')' : ''), l.id, l.testDriveNotes || l.nextStep);
      if (l.reservationStatus === 'Reserved') add(l.reservationDate, 'reservation', 'Reservation: ' + name, l.id, l.reservationAmount ? U.fmtMoney(l.reservationAmount) : '');
      add(l.paymentDate, 'payment', 'Payment: ' + name, l.id, l.paymentStatus || '');
      if (db.leads.isReleased(l)) add(l.releaseDate, 'release', 'Release: ' + name + (veh !== '—' ? ' (' + veh + ')' : ''), l.id, l.releaseDate);
      // anniversaries: same month-day in viewed year (from year after release onward)
      if (l.releaseDate) {
        const ry = parseInt(l.releaseDate.slice(0, 4), 10);
        if (year > ry) {
          const md = l.releaseDate.slice(5);
          const iso = year + '-' + md;
          if (String(iso) >= String(l.releaseDate)) add(iso, 'anniv', 'Release Anniversary: ' + name + ' (year ' + (year - ry) + ')', l.id, 'Celebrate the anniversary of your client.');
        }
      }
      // birthdays (individual leads)
      if (l.leadType === 'individual' && l.birthdate) {
        const md = l.birthdate.slice(5);
        const age = year - parseInt(l.birthdate.slice(0, 4), 10);
        if (age >= 0) add(year + '-' + md, 'birthday', 'Birthday: ' + name, l.id, (age > 0 ? age + ' years old' : ''));
      }
    });

    const tdByLead = {};
    leads.forEach(l => { if (l && l.testDriveDate) tdByLead[l.id] = l.testDriveDate; });

    (acts || []).forEach(a => {
      if (!a || typeof a !== 'object' || a.synthetic) return;
      const map = {
        'Test Drive': 'testdrive', 'Meeting': 'meeting', 'Financing Application': 'financing', 'Bank Coordination': 'financing',
        'Reservation': 'reservation', 'Payment': 'payment', 'Release': 'release', 'OR/CR': 'release', 'Plate': 'release'
      };
      const type = map[a.type] || 'activity';
      const iso = a.dueDate || a.activityDate || '';
      /* Test drives come from ONE source: the lead's own test-drive fields are
         rendered above, so a real activity must not duplicate the same date. */
      if (a.type === 'Test Drive' && tdByLead[a.leadId] && tdByLead[a.leadId] === iso) return;
      add(iso, type, a.type + ': ' + (a.leadName || '—') + (a.completed ? ' ✓' : ''), a.leadId || '', a.notes || a.nextStep);
    });

    return events;
  }

  function renderGrid(events, mk) {
    const [y, m] = mk.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDay = first.getDay();
    const dim = U.daysInMonth(mk);
    const prevDim = U.daysInMonth(U.addMonths(mk, -1));
    const today = U.todayISO();
    const byDay = {};
    events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });

    const weeks = [];
    let cur = [];
    for (let d = 0; d < startDay + dim; d++) {
      const day = d - startDay + 1;
      let iso, cls = '', dnum;
      if (day <= 0) { iso = U.addMonths(mk, -1) + '-' + U.pad2(prevDim + day); dnum = prevDim + day; cls = 'other'; }
      else if (day > dim) { iso = U.addMonths(mk, 1) + '-' + U.pad2(day - dim); dnum = day - dim; cls = 'other'; }
      else { iso = mk + '-' + U.pad2(day); dnum = day; }
      if (iso === today) cls += ' today';
      const evs = byDay[iso] || [];
      const hol = evs.find(e => e.type === 'holiday');
      const dots = evs.slice(0, 5);
      const more = evs.length - dots.length;
      cur.push('<div class="cal-day ' + cls + (hol ? ' holiday' : '') + '" data-iso="' + iso + '">' +
        '<span class="dnum">' + dnum + '</span>' +
        (hol ? '<span class="dhol">' + U.esc(hol.title) + '</span>' : '') +
        '<div class="devents">' +
        dots.map(e => '<span class="devent ' + e.cls + '" title="' + U.esc(TYPE[e.t] + ': ' + e.title) + '" data-idx="' + U.esc(evs.indexOf(e)) + '"></span>').join('') +
        (more > 0 ? '<span class="devent more">+' + more + '</span>' : '') +
        '</div>' +
        '<div class="ev-tooltip">' + evs.slice(0, 4).map(e => '<div style="margin-bottom:2px">' + U.esc(TYPE[e.t]) + ': <b>' + U.esc(e.title) + '</b></div>').join('') + (more > 0 ? '<div class="muted">+ ' + more + ' more…</div>' : '') + '</div>' +
        '</div>');
      if (cur.length === 7) { weeks.push(cur); cur = []; }
    }
    if (cur.length) { while (cur.length < 7) cur.push('<div class="cal-day other" style="background:transparent;border:none"></div>').toString(); weeks.push(cur); }

    document.getElementById('cal-grid').innerHTML = weeks.map(w => '<div class="cal-week">' + w.join('') + '</div>').join('');

    document.querySelectorAll('.cal-day').forEach(day => {
      const iso = day.dataset.iso;
      const evs = byDay[iso] || [];
      day.addEventListener('click', (e) => {
        if (!evs.length) return;
        e.stopPropagation();
        openDay(iso, evs);
      });
    });
  }

  function openDay(iso, evs) {
    App.modal({
      title: U.fmtDateLong(iso),
      size: 'md',
      content: '<div class="ev-list">' + evs.map(e => {
        const label = TYPE[e.t];
        return '<button type="button" class="ev-row js-evr" data-id="' + U.esc(e.leadId || '') + '">' +
          '<span class="ev-dot ev-' + U.esc(e.cls) + '"></span>' +
          '<span class="ev-txt"><b>' + U.esc(label + ': ' + e.title) + '</b><span>' + U.esc(e.meta || '—') + '</span></span>' +
          '</button>';
      }).join('') + '</div>',
      footer: '<span class="muted small">Click an event to open the related lead</span>'
    });
    const rows = document.querySelectorAll('.modal .js-evr');
    rows.forEach(r => r.addEventListener('click', () => {
      App.closeModal();
      if (r.dataset.id) { App.openLead(r.dataset.id); }
      else App.closeModal();
    }));
  }

  function renderSide(events) {
    const today = U.todayISO();
    const sorted = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const buckets = { today: [], '7': [], '30': [] };
    sorted.forEach(e => {
      const d = U.diffDays(today, e.date);
      if (d === 0) buckets.today.push(e);
      else if (d >= 1 && d <= 7) buckets['7'].push(e);
      else if (d >= 8 && d <= 30) buckets['30'].push(e);
    });
    const row = (e) => '<button type="button" class="ev-row js-evr" data-id="' + U.esc(e.leadId || '') + '">' +
      '<span class="ev-dot"></span>' +
      '<span class="ev-txt"><b>' + U.esc(e.title) + '</b><span>' + U.fmtDate(e.date, { short: true }) + (e.meta ? ' · ' + U.esc(e.meta) : '') + '</span></span></button>';
    const render = (el, arr) => { el.innerHTML = arr.length ? arr.map(row).join('') : '<div class="empty" style="padding:12px">Nothing scheduled.</div>'; bindRows(el); };
    render(document.getElementById('cal-today'), buckets.today.slice(0, 15));
    render(document.getElementById('cal-7'), buckets['7'].slice(0, 20));
    render(document.getElementById('cal-30'), buckets['30'].slice(0, 30));
  }

  function bindRows(el) {
    el.querySelectorAll('.js-evr').forEach(r => r.addEventListener('click', () => { if (r.dataset.id) App.openLead(r.dataset.id); }));
  }

  function renderHolidays(mk) {
    const el = document.getElementById('cal-holidays');
    const list = App._cache.holsCache || [];
    const inM = list.filter(h => U.inMonth(h.date, mk));
    el.innerHTML = inM.length ? inM.map(h =>
      '<div class="ev-row"><span class="ev-dot ev-c-holiday"></span><span class="ev-txt"><b>' + U.esc(h.name) + '</b><span>' + U.fmtDate(h.date, { short: true }) + '</span></span></div>'
    ).join('') : '<div class="empty" style="padding:12px">No holidays this month.</div>';
  }

  async function refresh() {
    try {
      const mk = App.month;
      document.getElementById('cal-title').textContent = U.monthLabel(mk);
      const leads = await App.load('leads');
      let acts = [];
      try { acts = await ActivityService.getAll(); }
      catch (e) { console.error('Failed to load activities', e); App.onError('Could not load activities.'); }
      const holidays = await App.load('holidays');
      App._cache.holsCache = holidays;
      const events = buildEvents(leads, acts, holidays, mk);
      renderGrid(events, mk);
      renderSide(events);
      renderHolidays(mk);
    } catch (e) {
      console.error('Calendar refresh failed', e);
      App.onError('Calendar could not load. Some data may be unavailable.');
    }
  }

  function boot() {
    document.querySelectorAll('.cal-nav .js-mprev, .cal-nav .js-mnext').forEach(b => {
      const dir = b.classList.contains('js-mprev') ? -1 : 1;
      b.innerHTML = App.icon(dir === -1 ? 'chevL' : 'chevR');
      b.addEventListener('click', () => App.setMonth(U.addMonths(App.month, dir)));
    });
    const mtoday = document.querySelector('.cal-nav .js-mtoday');
    if (mtoday) mtoday.addEventListener('click', () => App.setMonth(U.currentMonthKey()));
    refresh();
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:changed', () => refresh());
  document.addEventListener('crm:month', () => refresh());
})();