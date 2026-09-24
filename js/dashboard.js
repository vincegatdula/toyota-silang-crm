/* ============================================================
   Toyota CRM — dashboard.js
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
    return leads.filter(l => !l.archived && !db.leads.isReleased(l) && l.status !== 'Lost' && l.status !== 'Cold' && l.stage !== 'Lost');
  }

  function renderKPIs(leads, acts, mk) {
    const active = activeLeads(leads);
    const deals = liveDeals(leads);
    const hot = deals.filter(l => l.priority === 'Hot');
    const warm = deals.filter(l => l.priority === 'Warm');
    const today = U.todayISO();
    const dealsToClose = deals.filter(l => {
      if (['Reservation', 'Payment', 'Approval'].includes(l.stage)) return true;
      return l.estimatedPurchaseDate && U.diffDays(today, l.estimatedPurchaseDate) <= 30 && U.diffDays(today, l.estimatedPurchaseDate) >= 0;
    });
    const released = leads.filter(l => db.leads.isReleased(l));
    const releasedMonth = released.filter(l => U.inMonth(l.releaseDate, mk));
    const overdue = leads.filter(l => !l.archived && !db.leads.isReleased(l) && l.status !== 'Lost' && l.nextFollowupDate && U.isPast(l.nextFollowupDate));
    const todayActs = acts.filter(a => a.dueDate === today && !a.completed);
    const newMonth = leads.filter(l => U.inMonth(l.dateCreated, mk) && !l.archived);

    const kpis = [
      { label: 'Total Leads', val: leads.length, sub: '+ ' + newMonth.length + ' new this month', cls: 'k-blue' },
      { label: 'Active Deals', val: deals.length, sub: 'in the pipeline now', cls: '' },
      { label: 'Hot Leads', val: hot.length, sub: 'high priority', cls: 'k-red' },
      { label: 'Warm Leads', val: warm.length, sub: 'needs attention', cls: 'k-amber' },
      { label: 'Deals to Close', val: dealsToClose.length, sub: 'reservation/payment/30d', cls: 'k-amber' },
      { label: 'Closed / Released', val: released.length, sub: releasedMonth.length + ' this month', cls: 'k-green' },
      { label: 'Overdue Follow-ups', val: overdue.length, sub: 'needs action today', cls: (overdue.length ? 'k-red' : '') },
      { label: "Today's Activities", val: todayActs.length, sub: 'due & pending today', cls: '' }
    ];
    document.getElementById('dash-kpis').innerHTML = kpis.map(k =>
      '<div class="kpi ' + k.cls + '"><div class="k-label">' + k.label + '</div><div class="k-value">' + k.val + '</div><div class="k-sub">' + U.esc(k.sub) + '</div></div>'
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
      '<div class="kpi k-green"><div class="k-label">Closed</div><div class="k-value">' + U.fmtNum(closed) + '</div></div>' +
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
    const perDay = wdl > 0 ? (totalActual > 0 ? totalActual : 0) : 0;
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

    const item = (l) => {
      const overdue = fuRange(l) === 'overdue';
      return '<button type="button" class="up-item' + (overdue ? ' overdue' : '') + '" data-id="' + U.esc(l.id) + '">' +
        '<span class="up-date"><b>' + U.esc((l.nextFollowupDate || '').slice(8, 10)) + '</b><span>' + U.esc(new Date((l.nextFollowupDate || '')).toLocaleDateString('en-US', { month: 'short' })) + '</span></span>' +
        '<span class="up-meta"><span class="up-title">' + U.esc(LeadView.customerName(l)) + '</span>' +
        '<span class="up-sub">' + U.esc(LeadView.vehicleLabel(l)) + ' · ' + U.esc(l.nextStep || 'no next step') + '</span></span>' +
        '<span class="badge ' + (overdue ? 'badge-overdue' : '') + '">' + U.esc(l.stage) + '</span>' +
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

    // activities panel
    const tActs = acts.filter(a => !a.completed && a.dueDate && U.diffDays(t, a.dueDate) >= 0 && U.diffDays(t, a.dueDate) <= 30);
    const tActsOver = acts.filter(a => !a.completed && a.dueDate && U.diffDays(t, a.dueDate) < 0);
    const sorted = tActsOver.concat(tActs).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const aItem = (a) => {
      const ov = U.diffDays(t, a.dueDate) < 0;
      return '<button type="button" class="up-item' + (ov ? ' overdue' : '') + '" data-leadid="' + U.esc(a.leadId) + '">' +
        '<span class="up-date"><b>' + U.esc((a.dueDate || '').slice(8, 10)) + '</b><span>' + U.esc(new Date(a.dueDate || '').toLocaleDateString('en-US', { month: 'short' })) + '</span></span>' +
        '<span class="up-meta"><span class="up-title">' + U.esc(a.type) + ' — ' + U.esc(a.leadName || 'No lead') + '</span>' +
        '<span class="up-sub">' + U.esc(a.notes || '') + '</span></span>' +
        '<span class="badge ' + (ov ? 'badge-overdue' : 'badge-outline') + '">' + (ov ? 'overdue' : 'due ' + U.fmtDate(a.dueDate, { short: true })) + '</span>' +
        '</button>';
    };
    document.getElementById('up-act').innerHTML =
      '<div class="muted small" style="margin-bottom:6px">' + (tActsOver.length ? tActsOver.length + ' overdue · ' : '') + (tActs.length) + ' due in next 30 days</div>' +
      (sorted.length ? '<div class="upcoming-list">' + sorted.slice(0, 12).map(aItem).join('') + '</div>'
        : '<div class="empty" style="padding:18px">No pending activities.</div>');

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

  /* ---------- monthly trend chart ---------- */
  function renderTrend(leads, mk) {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(U.addMonths(mk, -i));
    const rows = months.map(m => {
      const newL = leads.filter(l => !l.archived && U.inMonth(l.dateCreated, m)).length;
      const rel = leads.filter(l => db.leads.isReleased(l) && U.inMonth(l.releaseDate, m)).length;
      return { m, newL, rel };
    });
    const max = Math.max(1, ...rows.map(r => Math.max(r.newL, r.rel)));
    const html = '<div class="vbar">' + rows.map(r =>
      '<div class="vb" title="' + U.monthLabel(r.m) + '">' +
      '<div class="vb-bar" style="height:' + Math.max(3, (r.rel / max) * 110) + 'px;background:#22c55e"></div>' +
      '<div class="vb-bar" style="height:' + Math.max(3, (r.newL / max) * 110) + 'px;background:' + (r.newL ? 'var(--red)' : 'var(--line)') + '"></div>' +
      '<div class="vb-lbl">' + U.toMonthLabel(r.m) + '</div></div>'
    ).join('') + '</div>' +
      '<div class="legend" style="font-size:11px"><span class="lg"><i style="width:9px;height:9px;background:var(--red);border-radius:3px;display:inline-block"></i> New leads</span><span class="lg"><i style="width:9px;height:9px;background:#22c55e;border-radius:3px;display:inline-block"></i> Released</span></div>';
    document.getElementById('chart-monthly').innerHTML = html;
  }

  /* ---------- init ---------- */
  async function refresh() {
    const mk = App.month;
    const [leads, acts] = await Promise.all([App.data('leads'), App.data('activities')]);
    document.getElementById('dash-month-badge').textContent = U.monthLabel(mk);
    document.getElementById('dash-welcome').innerHTML = 'Sales overview for <strong>' + U.monthLabel(mk) + '</strong>';
    document.getElementById('msp-month').textContent = U.monthLabel(mk);
    document.getElementById('lg-month').textContent = U.monthLabel(mk);
    renderKPIs(leads, acts, mk);
    await renderSalesProgress(leads, mk);
    await renderLeadGen(leads, mk);
    renderUpcoming(leads, acts);
    renderTrend(leads, mk);
    const demo = App.config && App.config.demoData && App.config.seeded ? true : false;
    document.getElementById('demo-banner').classList.toggle('hidden', !demo);
  }

  async function boot() {
    refresh();
    document.addEventListener('crm:changed', () => refresh());
    document.addEventListener('crm:month', () => refresh());
    document.querySelectorAll('.dash-tabs [data-range]').forEach(c => c.addEventListener('click', () => {
      rangeSw(c.dataset.range);
      Promise.all([App.data('leads'), App.data('activities')]).then(([l, a]) => renderUpcoming(l, a));
    }));
    const goF = document.querySelector('.js-gofollowup');
    if (goF) goF.addEventListener('click', () => location.href = 'leads.html');
    const rem = document.querySelector('.js-reminder');
    if (rem) rem.addEventListener('click', () => LeadView.openActivity({ onDone: () => refresh() }));
  }

  window.addEventListener('app:boot', boot);
})();