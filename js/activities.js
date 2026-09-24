/* ============================================================
   Toyota CRM — activities.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const D = { q: '', type: '', state: '', chip: '' };
  const CHIPS = [
    { k: '', l: 'All' }, { k: 'overdue', l: 'Overdue' }, { k: 'today', l: 'Due Today' },
    { k: 'week', l: 'Next 7 Days' }, { k: '30', l: 'Next 30 Days' }
  ];

  function actBucket(a) {
    const iso = a.dueDate || a.activityDate;
    if (a.completed) return { key: 'done', label: 'Completed', cls: 'fu-none' };
    const b = LeadView.fuBucket(iso);
    if (b.key === 'none' || b.key === 'future') return { key: 'future', label: iso ? 'Due ' + U.fmtDate(iso, { short: true }) : 'No due date', cls: 'fu-none' };
    return b;
  }

  function renderChips(el) {
    el.innerHTML = CHIPS.map(c => '<button type="button" class="chip' + (D.chip === c.k ? ' on' : '') + '" data-c="' + U.esc(c.k) + '">' + U.esc(c.l) + '</button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { D.chip = b.dataset.c; render(); }));
  }

  function matches(a) {
    if (D.q) {
      const hay = [a.id, a.leadId, a.leadName, a.type, a.outcome, a.notes, a.nextStep].map(x => String(x || '').toLowerCase()).join(' ');
      if (hay.indexOf(D.q.toLowerCase()) === -1) return false;
    }
    if (D.type && a.type !== D.type) return false;
    if (D.state === 'Pending' && a.completed) return false;
    if (D.state === 'Completed' && !a.completed) return false;
    if (D.chip) {
      const b = actBucket(a);
      if (D.chip === 'today') { if (b.key !== 'today' && b.key !== 'overdue') return false; }
      else if (b.key !== D.chip) return false;
    }
    return true;
  }

  function render() {
    const acts = (App._cache.actsCache || []);
    const list = acts.filter(matches);
    document.getElementById('act-count').textContent = list.length + ' of ' + acts.length + ' activities';
    const tbody = document.getElementById('act-tbody');
    if (!list.length) {
      tbody.innerHTML = '';
      document.getElementById('act-empty').classList.remove('hidden');
      document.getElementById('act-table-wrap').classList.add('hidden');
      document.getElementById('act-list').classList.add('hidden');
      return;
    }
    document.getElementById('act-empty').classList.add('hidden');
    document.getElementById('act-table-wrap').classList.remove('hidden');

    tbody.innerHTML = list.map(a => {
      const b = actBucket(a);
      const comp = a.completed;
      return '<tr class="' + (comp ? 'row-done' : '') + (b.key === 'overdue' ? ' row-overdue' : '') + '" data-id="' + U.esc(a.id) + '">' +
        '<td><input type="checkbox" class="act-check js-check" data-id="' + U.esc(a.id) + '"' + (comp ? ' checked' : '') + ' aria-label="Mark complete"></td>' +
        '<td data-label="ID"><span class="lead-id">' + U.esc(a.id) + '</span></td>' +
        '<td data-label="Lead"><strong>' + U.esc(LeadView.customerName({ name: a.leadName })) + '</strong>' +
        (a.leadId ? '<div class="muted small">' + U.esc(a.leadId) + '</div>' : '') + '</td>' +
        '<td data-label="Type"><span class="act-type-badge">' + U.esc(a.type) + '</span></td>' +
        '<td data-label="Activity date">' + U.fmtDate(a.activityDate, { short: true }) + '</td>' +
        '<td data-label="Due">' + (a.dueDate ? '<span class="duedate' + (b.key === 'overdue' ? ' overdue' : b.key === 'today' ? ' today' : '') + '">' + U.fmtDate(a.dueDate, { short: true }) + '</span>' : '—') + '</td>' +
        '<td data-label="Status"><span class="fu-chip ' + b.cls + '">' + U.esc(b.label) + '</span></td>' +
        '<td data-label="Next follow-up">' + (a.nextFollowup ? U.fmtDate(a.nextFollowup, { short: true }) : '—') + '</td>' +
        '<td data-label="Notes"><span class="muted">' + U.esc(a.notes || (a.outcome ? 'Outcome: ' + a.outcome : '—')) + '</span></td>' +
        '<td style="text-align:right"><div style="display:inline-flex;gap:4px">' +
        '<button type="button" class="btn icon ghost sm js-edit" data-id="' + U.esc(a.id) + '" aria-label="Edit">' + ic('edit') + '</button>' +
        '<button type="button" class="btn icon ghost sm js-del" data-id="' + U.esc(a.id) + '" aria-label="Delete">' + ic('trash') + '</button>' +
        '</div></td></tr>';
    }).join('');
    tbody.querySelectorAll('.js-check').forEach(c => c.addEventListener('change', async () => {
      try { await db.activities.setCompleted(c.dataset.id, c.checked); App.toast(c.checked ? 'Activity completed.' : 'Activity reopened.', 'success'); }
      catch (e) { App.toast('Unable to update activity.', 'error'); }
    }));
    tbody.querySelectorAll('.js-edit').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const a = await db.activities.get(b.dataset.id);
      LeadView.openActivity({ activity: a, onDone: refreshData });
    }));
    tbody.querySelectorAll('.js-del').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await App.confirm({ title: 'Delete activity?', message: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' });
      if (!ok) return;
      try { await db.activities.remove(b.dataset.id); App.toast('Activity deleted.', 'success'); }
      catch (err) { App.toast('Unable to delete activity.', 'error'); }
    }));

    // mobile cards
    const listEl = document.getElementById('act-list');
    listEl.innerHTML = list.map(a => {
      const b = actBucket(a);
      return '<div class="lead-card' + (a.completed ? ' done' : '') + '">' +
        '<div class="lc-top"><div style="min-width:0"><div class="lc-name">' + U.esc(a.type) + ' — ' + U.esc(a.leadName || 'No lead') + '</div>' +
        '<div class="lc-id mono">' + U.esc(a.id) + '</div></div>' +
        '<input type="checkbox" class="act-check js-check" data-id="' + U.esc(a.id) + '"' + (a.completed ? ' checked' : '') + ' aria-label="Mark complete"></div>' +
        '<div class="lc-row"><span class="fu-chip ' + b.cls + '">' + U.esc(b.label) + '</span>' +
        (a.dueDate ? '<span class="small muted">Due ' + U.fmtDate(a.dueDate, { short: true }) + '</span>' : '') + '</div>' +
        '<div class="lc-meta"><span>' + U.esc(a.notes || a.outcome || '') + '</span>' +
        '<span style="display:flex;gap:4px"><button type="button" class="btn icon ghost sm js-edit" data-id="' + U.esc(a.id) + '" aria-label="Edit">' + ic('edit') + '</button>' +
        '<button type="button" class="btn icon ghost sm js-del" data-id="' + U.esc(a.id) + '" aria-label="Delete">' + ic('trash') + '</button></span></div>' +
        '</div>';
    }).join('');
    listEl.classList.remove('hidden');
    listEl.querySelectorAll('.js-check').forEach(c => c.addEventListener('change', async () => {
      try { await db.activities.setCompleted(c.dataset.id, c.checked); App.toast(c.checked ? 'Activity completed.' : 'Activity reopened.', 'success'); }
      catch (e) { App.toast('Unable to update activity.', 'error'); }
    }));
    listEl.querySelectorAll('.js-edit').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const a = await db.activities.get(b.dataset.id);
      LeadView.openActivity({ activity: a, onDone: refreshData });
    }));
    listEl.querySelectorAll('.js-del').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await App.confirm({ title: 'Delete activity?', message: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' });
      if (!ok) return;
      try { await db.activities.remove(b.dataset.id); App.toast('Activity deleted.', 'success'); }
      catch (err) { App.toast('Unable to delete activity.', 'error'); }
    }));
  }

  async function refreshData() {
    const acts = await App.data('activities');
    App._cache.actsCache = acts;
    render();
  }

  function boot() {
    const cfg = App.config;
    const typeSel = document.getElementById('f-type');
    typeSel.innerHTML = '<option value="">All types</option>' + cfg.activityTypes.map(t => '<option>' + U.esc(t) + '</option>').join('');
    renderChips(document.getElementById('act-chips'));
    typeSel.addEventListener('change', (e) => { D.type = e.target.value; render(); });
    document.getElementById('f-state').addEventListener('change', (e) => { D.state = e.target.value; render(); });
    document.getElementById('act-search').addEventListener('input', U.debounce((e) => { D.q = e.target.value; render(); }, 150));
    document.querySelector('.js-add').addEventListener('click', () => LeadView.openActivity({ onDone: refreshData }));
    document.querySelector('.js-export').addEventListener('click', () => {
      const list = App._cache.actsCache || [];
      const rows = list.map(a => ({
        'Activity ID': a.id, 'Lead ID': a.leadId, 'Customer': a.leadName, 'Type': a.type,
        'Activity Date': a.activityDate, 'Due Date': a.dueDate, 'Completed': a.completed ? 'Yes' : 'No',
        'Outcome': a.outcome, 'Notes': a.notes, 'Next Step': a.nextStep, 'Next Follow-up': a.nextFollowup
      }));
      U.download('ToyotaCRM_Activities_' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
      App.toast('Activities exported to CSV.', 'success');
    });
    const url = new URL(location.href);
    const bucket = url.searchParams.get('bucket');
    if (bucket) { D.chip = bucket; history.replaceState({}, '', url.pathname.split('?')[0]); }
    refreshData();
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:changed', (e) => { if (e.detail && e.detail.table === 'activities') refreshData(); });
})();