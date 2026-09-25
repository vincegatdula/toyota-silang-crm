/* ============================================================
   Toyota CRM — targets.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;

  async function refresh() {
    const mk = App.month;
    const cfg = App.config;
    document.getElementById('tgt-sub').textContent = 'Configure and track targets for ' + U.monthLabel(mk);
    document.getElementById('tgt-month').textContent = U.monthLabel(mk);

    const tgt = await db.targets.get(mk);
    const leads = await App.data('leads');
    const holidays = await App.data('holidays');

    const salesTarget = U.int(tgt.salesTarget);
    const closed = leads.filter(l => db.leads.isReleased(l) && U.inMonth(l.releaseDate, mk)).length;
    const remaining = Math.max(0, salesTarget - closed);
    const ach = salesTarget > 0 ? (closed / salesTarget) * 100 : 0;
    const wd = U.int(tgt.workingDays) || U.int(cfg.workingDays) || U.workingDaysInMonth(mk, holidays);
    const wdl = U.workingDaysLeft(mk, holidays);
    const perDay = wdl > 0 ? remaining / wdl : remaining;
    const cr = U.int(tgt.closingRatio) || U.int(cfg.closingRatio) || 0;
    const leadsNeeded = cr > 0 ? Math.ceil((remaining / (cr / 100))) : remaining;

    document.getElementById('t-sales').value = tgt.salesTarget || '';
    document.getElementById('t-wd').value = tgt.workingDays || '';
    document.getElementById('t-cr').value = tgt.closingRatio || '';

    document.getElementById('tgt-kpis').innerHTML = [
      { l: 'Sales Target', v: U.fmtNum(salesTarget) },
      { l: 'Closed', v: U.fmtNum(closed), c: 'green' },
      { l: 'Remaining', v: U.fmtNum(remaining) },
      { l: 'Achievement', v: U.fmtPct(ach) },
      { l: 'Working Days Left', v: U.fmtNum(Math.max(0, wdl)) },
      { l: 'Required / Day', v: remaining > 0 ? U.fmtNum(perDay, 1) : '—' },
      { l: 'Closing Ratio', v: cr ? cr + '%' : '—' },
      { l: 'Est. Leads Needed', v: leadsNeeded !== 0 ? U.fmtNum(leadsNeeded) : '—' }
    ].map(k => '<div class="tgt-kpi"><div class="tk-label">' + k.l + '</div><div class="tk-val"' + (k.c ? ' style="color:#22c55e"' : '') + '>' + k.v + '</div></div>').join('');

    document.getElementById('tgt-ach').innerHTML =
      '<div class="progress" style="flex:1"><span style="width:' + Math.min(100, ach) + '%"></span></div>' +
      '<span style="font-weight:700">' + U.fmtPct(ach) + '</span>';

    // lead generation
    const lt = tgt.leadTargets || {};
    const sources = cfg.leadSources;
    const perSource = {};
    leads.filter(l => U.inMonth(l.dateCreated, mk) && !l.archived).forEach(l => { perSource[l.source] = (perSource[l.source] || 0) + 1; });
    const rows = sources.map(src => {
      const t = U.int(lt[src]);
      const a = perSource[src] || 0;
      const rem = Math.max(0, t - a);
      const rpd = wdl > 0 ? rem / wdl : rem;
      const pct = t > 0 ? (a / t) * 100 : 0;
      return '<tr>' +
        '<td class="source-label" data-label="Source">' + U.esc(src) + '</td>' +
        '<td data-label="Target"><input type="number" class="lg-target" data-src="' + U.esc(src) + '" min="0" value="' + t + '" aria-label="Target for ' + U.esc(src) + '"></td>' +
        '<td data-label="Actual">' + U.fmtNum(a) + '</td>' +
        '<td data-label="Remaining">' + U.fmtNum(rem) + '</td>' +
        '<td data-label="Required / day">' + (rem > 0 ? U.fmtNum(rpd, 1) : '—') + '</td>' +
        '<td style="min-width:150px" data-label="Achievement"><div class="leadgen-row"><div class="progress"><span style="width:' + Math.min(100, pct) + '%"></span></div>' + U.fmtNum(a) + '/' + U.fmtNum(t) + '</div></td>' +
        '</tr>';
    }).join('');
    document.getElementById('lg-tbody').innerHTML = rows;

    const totalTarget = Object.keys(lt).reduce((s, k) => s + U.int(lt[k]), 0);
    const totalActual = sources.reduce((s, src) => s + (perSource[src] || 0), 0);
    const totalRem = Math.max(0, totalTarget - totalActual);
    document.getElementById('lg-totals').innerHTML =
      'Totals — Target: <strong>' + U.fmtNum(totalTarget) + '</strong> · Actual: <strong>' + U.fmtNum(totalActual) + '</strong> · Remaining: <strong>' + U.fmtNum(totalRem) + '</strong>' +
      (totalRem > 0 && wdl > 0 ? ' · Required per day: <strong>' + U.fmtNum(totalRem / wdl, 1) + '</strong>' : '') +
      '. Required per day uses working days left (' + Math.max(0, wdl) + '), excluding weekends and holidays.';
  }

  async function save() {
    const mk = App.month;
    const cfg = App.config;
    const salesTarget = U.int(document.getElementById('t-sales').value);
    const workingDays = U.int(document.getElementById('t-wd').value);
    const closingRatio = U.int(document.getElementById('t-cr').value);
    const leadTargets = {};
    document.querySelectorAll('.lg-target').forEach(inp => { leadTargets[inp.dataset.src] = U.int(inp.value); });
    const tgt = await db.targets.get(mk);
    try {
      await db.targets.set(mk, Object.assign({}, tgt, { salesTarget, workingDays, closingRatio, leadTargets }));
      if (workingDays > 0) App.toast('Targets saved for ' + U.monthLabel(mk) + '.', 'success');
      else App.toast('Targets saved. Working days will use the default of ' + cfg.workingDays + '.', 'success');
    } catch (e) { App.toast('Unable to save targets.', 'error'); }
    refresh();
  }

  function boot() {
    refresh();
    document.querySelector('.js-save').addEventListener('click', save);
    document.getElementById('lg-tbody').addEventListener('input', U.debounce(() => { document.getElementById('lg-totals').classList.add('hidden'); }, 200));
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:month', () => refresh());
  document.addEventListener('crm:changed', () => refresh());
})();