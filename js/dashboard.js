/* ============================================================
   Toyota CRM — dashboard.js
   KPIs, sales progress, lead generation, follow-up feed, the
   Activities & Test Drive panel (via ActivityService) and the
   monthly trend chart.
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const D = {};
  let range = 'today';

  function fmtAmount(n) { return n || n === 0 ? U.fmtNum(Math.round(n)) : '<span class="muted">—</span>'; }

  /* ---------- helpers ---------- */
  function activeLeads(leads) { return leads.filter(l => !l.archived); }
  function liveDeals(leads) {
    return leads.filter(l => !l.archived && !db.leads.isReleased(l) && !db.leads.isWon(l) && l.status !== 'Lost' && l.status !== 'Cold' && l.stage !== 'Lost');
  }

  function renderKPIs(leads, acts, mk) {
    const active = activeLeads(leads);
    const deals = liveDeals(leads);
    const hot = deals.filter(l => l.priority === 'Hot');
    const warm = deals.filter(l => l.priority === 'Warm');
    const today = U.todayISO();
    /* Deals to close: active deals sitting at Reservation or Payment.
       (An estimate or date-flag is NOT a committed sale.) */
    const dealsToClose = deals.filter(l => l.stage === 'Reservation' || l.stage === 'Payment');
    const won = leads.filter(l => db.leads.isWon(l));
    const released = leads.filter(l => db.leads.isReleased(l));
    const releasedMonth = released.filter(l => U.inMonth(l.releaseDate, mk));
    const overdue = leads.filter(l => !l.archived && !db.leads.isReleased(l) && !db.leads.isWon(l) && l.status !== 'Lost' && l.nextFollowupDate && U.isPast(l.nextFollowupDate));
    const todayActs = acts.filter(a => a.dueDate === today && !a.completed);
    const newMonth = leads.filter(l => U.inMonth(l.dateCreated, mk) && !l.archived);

    const kpis = [
      { label: 'Total Leads', val: leads.length, sub: '+ ' + newMonth.length + ' new this month', cls: 'k-blue', tip: 'Every lead record in the system.' },
      { label: 'Active Deals', val: deals.length, sub: 'open in the pipeline', cls: '', tip: 'Not archived, not Released, not Lost/Cold, and stage is not "Deal Closed (Won)".' },
      { label: 'Hot Leads', val: hot.length, sub: 'high priority', cls: 'k-red', tip: 'Active deals marked Hot priority.' },
      { label: 'Warm Leads', val: warm.length, sub: 'needs attention', cls: 'k-amber', tip: 'Active deals marked Warm priority.' },
      { label: 'Deals to Close', val: dealsToClose.length, sub: 'Reservation & Payments', cls: 'k-amber', tip: 'Active deals at the Reservation or Payment stage.' },
      { label: 'Closed Deals', val: won.length, sub: 'stage = Deal Closed (Won)', cls: 'k-green', tip: 'Leads whose pipeline stage is "Deal Closed (Won)".' },
      { label: 'Overdue Follow-ups', val: overdue.length, sub: 'needs action today', cls: (overdue.length ? 'k-red' : ''), tip: 'Open leads with a past follow-up date.' },
      { label: "Today's Activities", val: todayActs.length, sub: 'due & pending today', cls: '', tip: 'Pending activities due today.' }
    ];
    document.getElementById('dash-kpis').innerHTML = kpis.map(k =>
      '<div class="kpi ' + k.cls + '" title="' + U.esc(k.tip) + '"><div class="k-label">' + k.label + '</div><div class="k-value">' + k.val + '</div><div class="k-sub">' + U.esc(k.sub) + '</div></div>'
    ).join('');
  }

  /* ---------- monthly sales progress ---------- */
  async function renderSalesProgress(leads, mk) {
    const cfg = App.config;
    const tgt = await db.targets.get(mk);
    const holidays = await App.data('holidays');
    const target = U.int(tgt.salesTarget);
    const closed = leads.filter(l => db.leads.isReleased(l) && U.inMonth(l.releaseDate, mk)).length;
    const remaining = Math.max(0, target - closed);
    const ach = target > 0 ? (closed / target) * 100 : 0;
    const wd = tgt.workingDays || cfg.workingDays || U.workingDaysInMonth(mk, holidays);
    const wdl = U.workingDaysLeft(mk, holidays);
    const perDay = wdl > 0 ? remaining / wdl : remaining;
    const el = document.getElementById('msp-body');
    el.innerHTML =
      '<div class="widget-sales">' +
      '<div class="kpi"><div class="k-label">Sales Target</div><div class="k-value">' + U.fmtNum(target) + '</div></div>' +
      '<div class="kpi k-green"><div class="k-label">Released</div><div class="k-value">' + U.fmtNum(closed) + '</div></div>' +
      '<div class="kpi k-amber"><div class="k-label">Remaining</div><div class="k-value">' + U.fmtNum(remaining) + '</div></div>' +
      '<div class="kpi' + (ach >= target && target ? ' k-green' : '') + '"><div class="k-label">Achievement</div><div class="k-value">' + U.fmtPct(ach) + '</div></div>' +
      '</div>' +
      '<div class="ach-row"><div class="progress"><span style="width:' + Math.min(100, ach) + '%"></span></div><span class="ach-big">' + U.fmtPct(ach) + '</span></div>' +
      '<div class="metric-line"><span class="ml-label">Working days this month</span><span class="ml-val">' + U.fmtNum(wd) + ' (approx)</span></div>' +
      '<div class="metric-line"><span class="ml-label">Working days left</span><span class="ml-val ' + (wdl > 0 ? 'pos' : 'neg') + '">' + U.fmtNum(Math.max(0, wdl)) + '</span></div>' +
      '<div class="metric-line"><span class="ml-label">Required releases / day</span><span class="ml-val">' + (remaining > 0 ? U.fmtNum(perDay, 1) : '—') + '</span></div>' +
      '<div class="tgt-sm-note muted">Target editable in Targets → ' + U.monthLabel(mk) + '</div>';
  }

  /* ---------- lead generation ---------- */
  async function renderLeadGen(leads, mk) {
    const tgt = await db.targets.get(mk);
    const holidays = await App.data('holidays');
    const cfg = App.config;
    const lt = tgt.leadTargets || {};
    const totalTarget = Object.keys(lt).reduce((s, k) => s + U.int(lt[k]), 0);
    const actual = leads.filter(l => U.inMonth(l.dateCreated, mk) && !l.archived);
    const perSource = {};
    actual.forEach(l => { perSource[l.source] = (perSource[l.source] || 0) + 1; });
    const totalActual = actual.length;
    const remaining = Math.max(0, totalTarget - totalActual);
    const wdl = U.workingDaysLeft(mk, holidays);
    const perDay = 0;
    const reqPerDay = wdl > 0 ? remaining / wdl : remaining;
    const ach = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    const el = document.getElementById('lg-body');
    const bars = Object.keys(lt).map(src => {
      const a = perSource[src] || 0;
      const t = U.int(lt[src]);
      const pct = t > 0 ? (a / t) * 100 : 0;
      return '<div class="metric-line" style="align-items:center"><span class="ml-label">' + U.esc(src) + ' <span class="muted">' + a + '/' + t + '</span></span>' +
        '<div class="progress" style="width:110px"><span style="width:' + Math.min(100, pct) + '%"></span></div></div>';
    }).join('');
    el.innerHTML =
      '<div class="metric-line"><span class="ml-label">Target (all sources)</span><span class="ml-val">' + U.fmtNum(totalTarget) + '</span></div>' +
      '<div class="metric-line"><span class="ml-label">Actual</span><span class="ml-val pos">' + U.fmtNum(totalActual) + '</span></div>' +
      '<div class="metric-line"><span class="ml-label">Remaining</span><span class="ml-val">' + U.fmtNum(remaining) + '</span></div>' +
      '<div class="metric-line"><span class="ml-label">Required / day</span><span class="ml-val">' + (remaining > 0 ? U.fmtNum(reqPerDay, 1) : '—') + '</span></div>' +
      '<div class="ach-row"><div class="progress"><span style="width:' + Math.min(100, ach) + '%"></span></div><span class="ach-big">' + U.fmtPct(ach) + '</span></div>' +
      (bars ? '<div style="margin-top:6px">' + bars + '</div>' : '');
  }

  /* ---------- upcoming ---------- */
  function fuRange(lead, mk) {
    const d = lead.nextFollowupDate;
    if (!d) return null;
    const t = U.todayISO();
    const diff = U.diffDays(t, d);
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff <= 7) return '7';
    if (diff <= 30) return '30';
    return null;
  }

  function renderUpcoming(leads, acts) {
    const t = U.todayISO();
    const follow = leads.filter(l => !l.archived && !db.leads.isReleased(l) && l.status !== 'Lost' && l.nextFollowupDate);
    const inRange = follow.filter(l => fuRange(l) !== null);
    const byBucket = { overdue: [], today: [], '7': [], '30': [] };
    inRange.forEach(l => byBucket[fuRange(l)].push(l));
    const sortKey = (a, b) => (a.nextFollowupDate || '').localeCompare(b.nextFollowupDate || '');
    byBucket.overdue.sort(sortKey); byBucket.today.sort(sortKey); byBucket['7'].sort(sortKey); byBucket['30'].sort(sortKey);

    const mini = (n) => App.icon(n, 'ic8', 12);
    const dTile = (iso) =>
      '<span class="up-date"><b>' + U.esc(iso.slice(8, 10)) + '</b><span>' + U.esc(new Date(iso).toLocaleDateString('en-US', { month: 'short' })) + '</span></span>';
    const meta2 = (iso, time) =>
      '<span class="up-meta2">' + mini('calendar') + U.fmtDate(iso, { short: true }) + (time ? ' · ' + U.esc(time) : '') + '</span>';

    const item = (l) => {
      const overdue = fuRange(l) === 'overdue';
      const iso = l.nextFollowupDate || '';
      return '<button type="button" class="up-item' + (overdue ? ' overdue' : '') + '" data-id="' + U.esc(l.id) + '">' +
        dTile(iso) +
        '<span class="up-meta"><span class="up-title">' + U.esc(LeadView.customerName(l)) + '</span>' +
        '<span class="up-sub">' + U.esc(LeadView.vehicleLabel(l)) + ' · ' + U.esc(l.nextStep || 'no next step') + '</span>' +
        meta2(iso) + '</span>' +
        '<span class="up-side"><span class="badge ' + (overdue ? 'badge-overdue' : '') + '">' + U.esc(l.stage) + '</span></span>' +
        '</button>';
    };
    const render = (list, emptyMsg, suffix) => {
      if (!list.length) return '<div class="empty" style="padding:18px">' + U.esc(emptyMsg) + '</div>';
      return '<div class="upcoming-list">' + list.map(item).join('') + (suffix ? suffix : '') + '</div>';
    };
    const ranges = {
      today: 'Due today & overdue',
      '7': 'Next 7 days',
      '30': 'Next 30 days'
    };
    const bucketKey = range === 'today' ? 'today' : range;
    const list = range === 'today' ? byBucket.overdue.concat(byBucket.today) : byBucket[bucketKey];
    document.getElementById('up-follow').innerHTML =
      '<div class="dash-tabs" style="margin:0 0 8px">' +
      Object.keys(ranges).map(k => '<button type="button" class="chip' + (k === bucketKey || (range === 'today' && k === 'today') ? ' on' : '') + '" data-bucket="' + k + '">' +
        ranges[k] + (k === 'today' ? ' (' + (byBucket.overdue.length + byBucket.today.length) + ')' : ' (' + byBucket[k].length + ')') + '</button>').join('') +
      '</div>' +
      render(list, 'No follow-ups scheduled in this range.', '');
    document.querySelectorAll('.dash-tabs [data-bucket]').forEach(b => b.addEventListener('click', () => {
      rangeSw(b.dataset.bucket);
      renderUpcoming(leads, acts);
    }));

    // activities & test-drive panel — reads the same ActivityService feed
    const pend = ActivityService.sortFeed(acts.filter(a => !a.completed));
    const shown = pend.slice(0, 8);
    const over = shown.filter(a => a.dueDate && U.diffDays(t, a.dueDate) < 0);
    const aItem = (a) => {
      const ov = a.dueDate && U.diffDays(t, a.dueDate) < 0;
      const iso = a.dueDate || a.activityDate || '';
      const stBadge = a.completed ? '<span class="badge badge-released">done</span>'
        : ov ? '<span class="badge badge-overdue">overdue</span>'
          : '<span class="badge badge-outline">scheduled</span>';
      return '<button type="button" class="up-item' + (ov ? ' overdue' : '') + '" data-leadid="' + U.esc(a.leadId) + '" title="' + U.esc(a.type + ' — ' + a.leadName) + '">' +
        dTile(iso) +
        '<span class="up-meta"><span class="up-title">' + U.esc(a.type) + ' — ' + U.esc(a.leadName || 'No lead') + '</span>' +
        '<span class="up-sub">' + U.esc(a.notes || '') + '</span>' +
        meta2(iso, a.time) + '</span>' +
        stBadge +
        '</button>';
    };
    const totalPending = pend.length;
    document.getElementById('up-act').innerHTML =
      '<div class="muted small" style="margin-bottom:8px">' +
      (totalPending ? totalPending + ' pending · ' : '') + (over.length ? over.length + ' overdue' : 'no overdue') + '</div>' +
      (shown.length ? '<div class="upcoming-list">' + shown.map(aItem).join('') + '</div>'
        : '<div class="empty up-empty">' + ic('activities', 'ic') +
          '<strong>No pending activities</strong>' +
          '<span class="muted">Add follow-ups, calls or test drives from any lead to see them here.</span></div>') +
      '<div class="up-more"><a href="activities.html">View all activities ' + ic('chevR', 'ic') + '</a></div>';

    document.querySelectorAll('#up-act .up-item').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.leadid) App.openLead(b.dataset.leadid);
    }));
    document.querySelectorAll('#up-follow .up-item').forEach(b => b.addEventListener('click', () => App.openLead(b.dataset.id)));
  }

  function rangeSw(r) {
    range = r === 'today' ? 'today' : (r === '7' ? '7' : '30');
    document.querySelectorAll('.dash-tabs [data-range]').forEach(c => c.classList.toggle('on', c.dataset.range === range));
    document.querySelectorAll('.dash-tabs [data-bucket]').forEach(c => c.classList.remove('on'));
  }

  /* ---------- monthly trend chart ----------
     Grouped bars (New leads in red, Released in neutral slate),
     explicit Y axis, month labels, legend and per-bar value labels.
     Zero-data months keep a readable baseline instead of collapsing. */
  function renderTrend(leads, mk) {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(U.addMonths(mk, -i));
    const rows = months.map(m => {
      const newL = leads.filter(l => !l.archived && U.inMonth(l.dateCreated, m)).length;
      const rel = leads.filter(l => db.leads.isReleased(l) && U.inMonth(l.releaseDate, m)).length;
      return { m, newL, rel };
    });
    const hasData = rows.some(r => r.newL + r.rel > 0);
    const max = Math.max(4, ...rows.map(r => Math.max(r.newL, r.rel)));

    const ticks = 4;
    const labels = [];
    for (let i = 0; i < ticks; i++) labels.push(Math.round((max * i) / (ticks - 1)));

    const bar = (v, cls, lbl) =>
      '<div class="mt-bar ' + cls + '" style="height:' + (v > 0 ? Math.max(6, Math.round((v / max) * 100)) : 2) + '%" title="' + U.esc(lbl) + ': ' + v + '">' +
      (v > 0 ? '<span>' + v + '</span>' : '') + '</div>';

    const cols = rows.map(r =>
      '<div class="mt-col"><div class="mt-g">' +
      bar(r.newL, 'mt-new', 'New leads') +
      bar(r.rel, 'mt-rel', 'Released') +
      '</div></div>'
    ).join('');

    const y = labels.map(l => '<span>' + l + '</span>').join('');

    document.getElementById('chart-monthly').innerHTML =
      (hasData
        ? '<div class="mt-wrap">' +
          '<div class="mt-plot">' +
          '<div class="mt-lines"><i></i><i></i><i></i><i></i></div>' +
          '<div class="mt-y">' + y + '</div>' +
          '<div class="mt-columns">' + cols + '</div>' +
          '</div>' +
          '<div class="mt-x">' + rows.map(r => '<span>' + U.esc(U.toMonthLabel(r.m)) + '</span>').join('') + '</div>' +
          '<div class="mt-legend"><span class="lg"><i class="lg-red"></i> New leads</span><span class="lg"><i class="lg-slate"></i> Released</span></div>' +
          '</div>'
        : '<div class="empty">' + ic('reports', 'ic') + '<strong>No data yet</strong>' +
          '<span class="muted">New leads and released units will appear here by month.</span></div>');
  }

  /* ---------- init ---------- */
  async function refresh() {
    try {
      const mk = App.month;
      const leadsPromise = App.load('leads');
      let acts = [];
      try { acts = await ActivityService.getAll(); }
      catch (e) { console.error('Failed to load activities', e); App.onError('Could not load activities.'); }
      const leads = await leadsPromise;

      document.getElementById('dash-month-badge').textContent = U.monthLabel(mk);
      document.getElementById('dash-welcome').innerHTML = 'Sales overview for <strong>' + U.monthLabel(mk) + '</strong>';
      document.getElementById('msp-month').textContent = U.monthLabel(mk);
      document.getElementById('lg-month').textContent = U.monthLabel(mk);
      renderKPIs(leads, acts, mk);
      try { await renderSalesProgress(leads, mk); } catch (e) { console.error(e); }
      try { await renderLeadGen(leads, mk); } catch (e) { console.error(e); }
      renderUpcoming(leads, acts);
      renderTrend(leads, mk);
      const demo = App.config && App.config.demoData && App.config.seeded ? true : false;
      document.getElementById('demo-banner').classList.toggle('hidden', !demo);
    } catch (e) {
      console.error('Dashboard refresh failed', e);
      App.onError('Dashboard could not load. Some data may be unavailable.');
    }
  }

  async function boot() {
    refresh();
    document.addEventListener('crm:changed', () => refresh());
    document.addEventListener('crm:month', () => refresh());
    document.querySelectorAll('.dash-tabs [data-range]').forEach(c => c.addEventListener('click', () => {
      rangeSw(c.dataset.range);
      Promise.all([App.data('leads'), ActivityService.getAll()])
        .then(([l, a]) => renderUpcoming(l, a))
        .catch(e => console.error(e));
    }));
    const goF = document.querySelector('.js-gofollowup');
    if (goF) goF.addEventListener('click', () => location.href = 'leads.html');
    const rem = document.querySelector('.js-reminder');
    if (rem) rem.addEventListener('click', () => LeadView.openActivity({ onDone: () => refresh() }));
  }

  window.addEventListener('app:boot', boot);
})();