/* ============================================================
   Toyota CRM — reports.js
   Pure-CSS charts (hbar / vbar) — no chart library.
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 13);

  let ALL_LEADS = [];
  let ALL_ACTS = [];

  const COLORS = ['', 'teal', 'blue', 'amber', 'green', 'grey'];

  function countBy(arr, keyFn) {
    const m = {};
    arr.forEach(x => { const k = keyFn(x); if (k === undefined || k === null || k === '') return; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort((a, b) => m[b] - m[a]).map(k => ({ label: k, value: m[k] }));
  }

  function hbarCard(title, data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map(d => d.value));
    const color = (i) => COLORS[(opts.colorOffset || 0) + (i % COLORS.length)];
    const body = data.length
      ? '<div class="hbar">' + data.map((d, i) =>
        '<div class="hb-row"><span class="hb-label" title="' + U.esc(d.label) + '">' + U.esc(d.label) + '</span>' +
        '<span class="hb-track"><span class="' + color(i) + '" style="width:' + Math.max(3, (d.value / max) * 100) + '%"></span></span>' +
        '<span class="hb-val">' + U.fmtNum(d.value) + '</span></div>'
      ).join('') + '</div>'
      : '<div class="rep-no">No data yet.</div>';
    return '<div class="card rep-card"><div class="card-body">' +
      '<h3>' + U.esc(title) + '<span class="rep-total">' + data.reduce((s, d) => s + d.value, 0) + ' total</span></h3>' + body +
      '</div></div>';
  }

  function vbarCard(title, months, getVal) {
    const rows = months.map(m => ({ m, v: getVal(m) }));
    const max = Math.max(1, ...rows.map(r => r.v));
    const body = rows.length
      ? '<div class="vbar">' + rows.map(r =>
        '<div class="vb" title="' + U.monthLabel(r.m) + ' · ' + r.v + '">' +
        '<div class="vb-bar" style="height:' + Math.max(3, (r.v / max) * 120) + 'px;background:' + (r.v ? 'var(--red)' : 'var(--line)') + '"></div>' +
        '<span style="font-size:10px;font-weight:650">' + U.fmtNum(r.v) + '</span>' +
        '<div class="vb-lbl">' + U.toMonthLabel(r.m) + '</div></div>'
      ).join('') + '</div>'
      : '<div class="rep-no">No data yet.</div>';
    return '<div class="card rep-card"><div class="card-body">' +
      '<h3>' + U.esc(title) + '</h3>' + body +
      '</div></div>';
  }

  async function refresh() {
    const [leads, acts] = await Promise.all([App.data('leads'), App.data('activities')]);
    ALL_LEADS = leads.filter(l => !l.archived);
    ALL_ACTS = acts;
    const mk = App.month;

    const stats = document.getElementById('rep-stats');
    const released = ALL_LEADS.filter(db.leads.isReleased);
    const active = ALL_LEADS.filter(l => !db.leads.isReleased(l) && l.status !== 'Lost' && l.status !== 'Cold' && l.stage !== 'Lost');
    const overdue = ALL_LEADS.filter(l => l.nextFollowupDate && U.isPast(l.nextFollowupDate));
    const conv = ALL_LEADS.length ? (released.length / ALL_LEADS.length) * 100 : 0;
    const avgDays = released.length ? Math.round(released.reduce((s, l) => s + (U.diffDays(l.dateCreated, l.releaseDate) || 0), 0) / released.length) : null;
    stats.innerHTML =
      '<div class="rep-stat"><div class="rs-val">' + U.fmtNum(ALL_LEADS.length) + '</div><div class="rs-label">Total Leads</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + U.fmtNum(released.length) + '</div><div class="rs-label">Released</div><div class="small muted">' + U.fmtNum(ALL_LEADS.filter(l => !l.archived).length - released.length) + ' still in pipeline</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + U.fmtNum(active.length) + '</div><div class="rs-label">Active Deals</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + U.fmtPct(conv) + '</div><div class="rs-label">Conversion Rate</div><div class="small muted">released / all leads</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + U.fmtNum(overdue.length) + '</div><div class="rs-label">Overdue Follow-ups</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + (avgDays !== null ? U.fmtNum(avgDays) : '—') + '</div><div class="rs-label">Avg Days to Close</div><div class="small muted">released only</div></div>' +
      '<div class="rep-stat"><div class="rs-val">' + U.fmtNum(acts.filter(a => a.completed).length) + ' / ' + U.fmtNum(acts.length) + '</div><div class="rs-label">Activities Completed</div></div>';

    // months series
    const months = [];
    for (let i = 11; i >= 0; i--) months.push(U.addMonths(mk, -i));

    const grid = document.getElementById('rep-grid');
    const bySource = countBy(ALL_LEADS, l => l.source);
    const byStatus = countBy(ALL_LEADS, l => l.status);
    const byStage = countBy(ALL_LEADS, l => l.stage);
    const byPriority = countBy(ALL_LEADS, l => l.priority);
    const byVehicle = countBy(ALL_LEADS, l => l.vehicleInterest);
    const byMonth = countBy(ALL_LEADS, l => (l.dateCreated || '').slice(0, 7));
    const releasedMonth = countBy(released, l => (l.releaseDate || '').slice(0, 7));

    const srcConv = bySource.map(s => {
      const rel = released.filter(l => l.source === s.label).length;
      return { label: s.label, value: s.value, conv: s.value ? (rel / s.value) * 100 : 0, rel };
    });

    // lost
    const lost = ALL_LEADS.filter(l => l.status === 'Lost' || l.stage === 'Lost');
    const lostHTML = lost.length
      ? '<div class="hbar">' + lost.slice(0, 8).map(l =>
        '<div class="hb-row"><span class="hb-label">' + U.esc(LeadView.customerName(l)) + '</span>' +
        '<span class="hb-track"><span class="grey" style="width:100%"></span></span>' +
        '<span class="hb-val">' + U.esc(l.id) + '</span></div>').join('') +
      (lost.length > 8 ? '<div class="muted small" style="margin-top:6px">' + (lost.length - 8) + ' more…</div>' : '') +
      '</div>'
      : '<div class="rep-no">No lost leads.</div>';

    const overdueHTML = overdue.length
      ? '<div class="hbar">' + overdue.slice(0, 8).map(l =>
        '<div class="hb-row"><span class="hb-label">' + U.esc(LeadView.customerName(l)) + '</span>' +
        '<span class="hb-track"><span class="amber" style="width:100%"></span></span>' +
        '<span class="hb-val">' + U.esc(U.fmtDate(l.nextFollowupDate, { short: true })) + '</span></div>').join('') + '</div>'
      : '<div class="rep-no">Nothing overdue.</div>';

    const salesByVeh = countBy(released, l => l.vehicleInterest);

    grid.innerHTML =
      hbarCard('Leads by Source', bySource) +
      hbarCard('Leads by Status', byStatus) +
      hbarCard('Leads by Pipeline Stage', byStage, { colorOffset: 1 }) +
      hbarCard('Leads by Priority', byPriority, { colorOffset: 2 }) +
      hbarCard('Leads by Vehicle', byVehicle, { colorOffset: 3 }) +
      vbarCard('Leads by Month', months, m => byMonth[m] || 0) +
      vbarCard('Closed Deals by Month', months, m => releasedMonth[m] || 0) +
      '<div class="card rep-card"><div class="card-body"><h3>Lead Source Conversion<span class="rep-total">released / all by source</span></h3>' +
      (srcConv.length ? '<div class="hbar">' + srcConv.slice(0, 9).map(o =>
        '<div class="hb-row" title="' + o.rel + ' released of ' + o.value + '">' +
        '<span class="hb-label">' + U.esc(o.label) + '</span>' +
        '<span class="hb-track"><span class="green" style="width:' + Math.max(3, o.conv) + '%"></span></span>' +
        '<span class="hb-val">' + (o.value ? U.fmtPct(o.conv) + ' (' + o.rel + ')' : '—') + '</span></div>').join('') + '</div>'
        : '<div class="rep-no">No data yet.</div>') + '</div></div>' +
      '<div class="card rep-card"><div class="card-body"><h3>Lost Leads<span class="rep-total">' + lost.length + ' lost</span></h3>' + lostHTML + '</div></div>' +
      '<div class="card rep-card"><div class="card-body"><h3>Overdue Follow-ups<span class="rep-total">' + overdue.length + '</span></h3>' + overdueHTML + '</div></div>' +
      '<div class="card rep-card"><div class="card-body"><h3>Activities by Type<span class="rep-total">' + acts.length + '</span></h3>' +
      hbarCardInner(countBy(ALL_ACTS, a => a.type)) + '</div></div>' +
      hbarCard('Sales by Vehicle (released)', salesByVeh, { colorOffset: 4 });

    // store for CSV export
    window.__repData = { bySource, byStatus, byStage, byPriority, byVehicle, byMonth, releasedMonth, srcConv, lost, overdue, avgDays, conv, salesByVeh };
  }

  function hbarCardInner(data) {
    const max = Math.max(1, ...data.map(d => d.value));
    return data.length
      ? '<div class="hbar">' + data.map(d =>
        '<div class="hb-row"><span class="hb-label">' + U.esc(d.label) + '</span>' +
        '<span class="hb-track"><span class="blue" style="width:' + Math.max(3, (d.value / max) * 100) + '%"></span></span>' +
        '<span class="hb-val">' + U.fmtNum(d.value) + '</span></div>').join('') + '</div>'
      : '<div class="rep-no">No data yet.</div>';
  }

  function exportAll() {
    const d = window.__repData || {};
    const today = U.todayISO();
    const sections = [];
    const push = (name, rows) => { if (rows && rows.length) sections.push(toSection(name, rows)); };
    const toSection = (name, rows) => {
      const keys = Object.keys(rows[0]);
      const body = rows.map(r => keys.map(k => String(r[k] === undefined ? '' : r[k]).replace(/[\n"]/g, ' ').trim()).join(','));
      return [name + '|||', keys.join(','), ...body].join('\n');
    };
    const map = (arr) => arr.map(x => Object.assign({}, x));
    push('LEADS BY SOURCE', d.bySource); push('LEADS BY STATUS', d.byStatus); push('LEADS BY STAGE', d.byStage);
    push('LEADS BY PRIORITY', d.byPriority); push('LEADS BY VEHICLE', d.byVehicle);
    push('LEADS BY MONTH', Object.keys(d.byMonth || {}).map(m => ({ Month: m, Leads: d.byMonth[m] })));
    push('CLOSED BY MONTH', Object.keys(d.releasedMonth || {}).map(m => ({ Month: m, Released: d.releasedMonth[m] })));
    push('SOURCE CONVERSION', d.srcConv.map(o => ({ Source: o.label, Leads: o.value, Released: o.rel, ConvPct: o.value ? Math.round((o.rel / o.value) * 1000) / 10 : '' })));
    push('SALES BY VEHICLE', d.salesByVeh);
    let csv = '\uFEFFToyota CRM Report Export — ' + today + '\n\n' + sections.join('\n\n\n');
    U.download('ToyotaCRM_Reports_' + today + '.csv', csv, 'text/csv');
    App.toast('Report export downloaded.', 'success');
  }

  function boot() {
    document.getElementById('rep-export').addEventListener('click', exportAll);
    refresh();
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:changed', () => refresh());
  document.addEventListener('crm:month', () => refresh());
})();