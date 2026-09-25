/* ============================================================
   Toyota CRM — activities.js
   The Activities page reads through `ActivityService` (the single
   source of truth shared with the Dashboard card and Calendar).
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const D = { q: '', type: '', state: '', chip: '' };
  const CHIPS = [
    { k: '', l: 'All' },
    { k: 'overdue', l: 'Overdue' },
    { k: 'today', l: 'Today' },
    { k: 'upcoming', l: 'Upcoming' },
    { k: 'done', l: 'Completed' }
  ];

  const actDateOf = (a) => a.dueDate || a.activityDate || '';

  /* Consistent status badge shared by table + cards. */
  function stateBadge(a) {
    if (a.completed) return { label: 'Completed', cls: 'fu-done' };
    const iso = actDateOf(a);
    if (!iso) return { label: 'No due date', cls: 'fu-none' };
    const d = U.diffDays(U.todayISO(), iso);
    if (d < 0) return { label: 'Overdue', cls: 'fu-overdue' };
    if (d === 0) return { label: 'Due today', cls: 'fu-today' };
    if (d <= 7) return { label: 'Due in ' + d + ' days', cls: 'fu-week' };
    if (d <= 30) return { label: 'Due in ' + d + ' days', cls: 'fu-30' };
    return { label: 'Due ' + U.fmtDate(iso, { short: true }), cls: 'fu-none' };
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
      const b = stateBadge(a);
      if (D.chip === 'today') { if (b.cls !== 'fu-today') return false; }
      else if (D.chip === 'overdue') { if (b.cls !== 'fu-overdue') return false; }
      else if (D.chip === 'done') { if (!a.completed) return false; }
      else if (D.chip === 'upcoming') {
        if (a.completed) return false;
        const iso = actDateOf(a);
        if (!iso) return false;
        const d = U.diffDays(U.todayISO(), iso);
        if (!(d > 0 && d <= 30)) return false;
      }
    }
    return true;
  }

  function renderChips(el) {
    el.innerHTML = CHIPS.map(c => '<button type="button" class="chip' + (D.chip === c.k ? ' on' : '') + '" data-c="' + U.esc(c.k) + '">' + U.esc(c.l) + '</button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { D.chip = b.dataset.c; render(); }));
  }

  const timeStr = (a) => (a && a.time) ? ' · ' + U.esc(a.time) : '';
  const dueCell = (a, b) => {
    if (!a.dueDate) return '—';
    return '<span class="duedate' + (b.cls === 'fu-overdue' ? ' overdue' : b.cls === 'fu-today' ? ' today' : '') + '">' +
      U.fmtDate(a.dueDate, { short: true }) + timeStr(a) + '</span>';
  };

  function actRow(a) {
    const b = stateBadge(a);
    const comp = a.completed;
    const leadCol =
      '<td data-label="Lead"><strong>' + U.esc(a.leadName) + '</strong>' +
      (a.leadArchived ? '<div class="muted small">Archived lead</div>' : '') +
      (a.leadUnavailable ? '<div class="muted small unavailable">Lead unavailable</div>' : '') +
      (a.leadId ? '<div class="muted small">' + U.esc(a.leadId) + '</div>' : '') + '</td>';
    return '<tr class="' + (comp ? 'row-done' : '') + (b.cls === 'fu-overdue' ? ' row-overdue' : '') + ' js-actrow" data-id="' + U.esc(a.id) + '" data-lead="' + U.esc(a.leadId || '') + '" tabindex="0" aria-label="Activity ' + U.esc(a.id) + (a.leadId ? ' for ' + U.esc(a.leadName) : '') + '">' +
      '<td><input type="checkbox" class="act-check js-check" data-id="' + U.esc(a.id) + '"' + (comp ? ' checked' : '') + ' aria-label="Mark complete"></td>' +
      '<td data-label="ID"><span class="lead-id">' + U.esc(a.id) + '</span></td>' +
      leadCol +
      '<td data-label="Type"><span class="act-type-badge">' + U.esc(a.type) + '</span></td>' +
      '<td data-label="Activity date">' + U.fmtDate(a.activityDate, { short: true }) + timeStr(a) + '</td>' +
      '<td data-label="Due">' + dueCell(a, b) + '</td>' +
      '<td data-label="Status"><span class="fu-chip ' + b.cls + '">' + U.esc(b.label) + '</span></td>' +
      '<td data-label="Next follow-up">' + (a.nextFollowup ? U.fmtDate(a.nextFollowup, { short: true }) : '—') + '</td>' +
      '<td data-label="Notes"><span class="muted">' + U.esc(a.notes || (a.outcome ? 'Outcome: ' + a.outcome : '—')) + '</span></td>' +
      '<td class="no-caption" style="text-align:right"><div style="display:inline-flex;gap:4px">' +
      '<button type="button" class="btn icon ghost sm js-edit" data-id="' + U.esc(a.id) + '" aria-label="Edit">' + ic('edit') + '</button>' +
      '<button type="button" class="btn icon ghost sm js-del" data-id="' + U.esc(a.id) + '" aria-label="Delete">' + ic('trash') + '</button>' +
      '</div></td></tr>';
  }

  function actCard(a) {
    const b = stateBadge(a);
    return '<div class="lead-card' + (a.completed ? ' done' : '') + '"' + (a.leadId ? ' data-lead="' + U.esc(a.leadId) + '"' : '') + '>' +
      '<div class="lc-top"><div style="min-width:0"><div class="lc-name">' + U.esc(a.type) + ' — ' + U.esc(a.leadName) + '</div>' +
      '<div class="lc-id mono">' + U.esc(a.id) + (a.leadId ? ' · ' + U.esc(a.leadId) : '') + '</div></div>' +
      '<input type="checkbox" class="act-check js-check" data-id="' + U.esc(a.id) + '"' + (a.completed ? ' checked' : '') + ' aria-label="Mark complete"></div>' +
      '<div class="lc-row"><span class="fu-chip ' + b.cls + '">' + U.esc(b.label) + '</span>' +
      (a.dueDate ? '<span class="small muted">Due ' + U.fmtDate(a.dueDate, { short: true }) + timeStr(a) + '</span>' : '') + '</div>' +
      (a.leadArchived ? '<div class="muted small">Archived lead</div>' : a.leadUnavailable ? '<div class="muted small unavailable">Lead unavailable</div>' : '') +
      '<div class="lc-meta"><span>' + U.esc(a.notes || a.outcome || '') + '</span>' +
      '<span style="display:flex;gap:4px"><button type="button" class="btn icon ghost sm js-edit" data-id="' + U.esc(a.id) + '" aria-label="Edit">' + ic('edit') + '</button>' +
      '<button type="button" class="btn icon ghost sm js-del" data-id="' + U.esc(a.id) + '" aria-label="Delete">' + ic('trash') + '</button></span></div>' +
      '</div>';
  }

  function bindRowHandlers() {
    document.querySelectorAll('#act-tbody .js-actrow, #act-list .lead-card').forEach(row => {
      const leadId = row.getAttribute('data-lead');
      const openLead = () => { if (leadId) App.openLead(leadId); };
      if (row.classList.contains('js-actrow')) {
        row.addEventListener('click', (e) => { if (!e.target.closest('button, input')) openLead(); });
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLead(); } });
      } else if (row.classList.contains('lead-card')) {
        row.addEventListener('click', (e) => { if (!e.target.closest('button, input')) openLead(); });
      }
    });
    const onCheck = (c) => c.addEventListener('change', async () => {
      try { await db.activities.setCompleted(c.dataset.id, c.checked); App.toast(c.checked ? 'Activity completed.' : 'Activity reopened.', 'success'); }
      catch (e) { App.toast('Unable to update activity.', 'error'); }
    });
    document.querySelectorAll('#act-tbody .js-check, #act-list .js-check').forEach(onCheck);
    const onEdit = (b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const a = await db.activities.get(b.dataset.id);
      LeadView.openActivity({ activity: a, onDone: refreshData });
    });
    document.querySelectorAll('#act-tbody .js-edit, #act-list .js-edit').forEach(onEdit);
    const onDel = (b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await App.confirm({ title: 'Delete activity?', message: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' });
      if (!ok) return;
      try { await db.activities.remove(b.dataset.id); App.toast('Activity deleted.', 'success'); }
      catch (err) { App.toast('Unable to delete activity.', 'error'); }
    });
    document.querySelectorAll('#act-tbody .js-del, #act-list .js-del').forEach(onDel);
  }

  function emptyState() {
    const el = document.getElementById('act-empty');
    const total = (App._cache.actsCache || []).length;
    el.classList.remove('hidden');
    if (!total) {
      el.innerHTML = ic('activities', 'ic') +
        '<strong>No activities yet</strong>' +
        '<span class="muted">Activities linked to your leads will appear here.</span>' +
        '<button type="button" class="btn sm primary js-add-here">+ New Activity</button>';
      const btn = el.querySelector('.js-add-here');
      if (btn) btn.addEventListener('click', () => LeadView.openActivity({ onDone: refreshData }));
    } else {
      el.innerHTML = ic('search', 'ic') + '<strong>No activities match your filters</strong>' +
        '<span class="muted">Try a different search or filter.</span>';
    }
  }

  function render() {
    const acts = (App._cache.actsCache || []).filter(matches);
    document.getElementById('act-count').textContent = acts.length + ' of ' + (App._cache.actsCache || []).length + ' activities';
    const tbody = document.getElementById('act-tbody');
    const listEl = document.getElementById('act-list');
    if (!acts.length) {
      tbody.innerHTML = '';
      listEl.innerHTML = '';
      listEl.classList.add('hidden');
      document.getElementById('act-table-wrap').classList.add('hidden');
      emptyState();
      return;
    }
    document.getElementById('act-empty').classList.add('hidden');
    document.getElementById('act-table-wrap').classList.remove('hidden');
    tbody.innerHTML = acts.map(actRow).join('');
    listEl.innerHTML = acts.map(actCard).join('');
    listEl.classList.remove('hidden');
    bindRowHandlers();
  }

  async function refreshData() {
    const acts = await ActivityService.getAll();
    App._cache.actsCache = ActivityService.sortFeed(acts);
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
        'Activity Date': a.activityDate, 'Time': a.time || '', 'Due Date': a.dueDate,
        'Completed': a.completed ? 'Yes' : 'No', 'Outcome': a.outcome, 'Notes': a.notes,
        'Next Step': a.nextStep, 'Next Follow-up': a.nextFollowup
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