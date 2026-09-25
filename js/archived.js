/* ============================================================
   Toyota CRM — archived.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const D = { q: '', stage: '' };

  function matches(l) {
    if (D.q) {
      const hay = [l.id, l.name, l.companyName, l.mobile, l.vehicleInterest, l.stage, l.status].map(x => String(x || '').toLowerCase()).join(' ');
      if (hay.indexOf(D.q.toLowerCase()) === -1) return false;
    }
    if (D.stage && l.stage !== D.stage) return false;
    return true;
  }

  function render() {
    const all = App._cache.archCache || [];
    const list = all.filter(matches);
    document.getElementById('arch-count').textContent = list.length + ' of ' + all.length + ' archived lead' + (all.length === 1 ? '' : 's');
    document.getElementById('arch-empty').classList.toggle('hidden', !!list.length);
    const tbody = document.getElementById('arch-tbody');
    tbody.innerHTML = list.map(l =>
      '<tr class="clickable" data-id="' + U.esc(l.id) + '">' +
      '<td data-label="ID"><span class="lead-id">' + U.esc(l.id) + '</span></td>' +
      '<td data-label="Lead"><strong>' + U.esc(LeadView.customerName(l)) + '</strong></td>' +
      '<td data-label="Vehicle">' + U.esc(LeadView.vehicleLabel(l)) + '</td>' +
      '<td data-label="Stage">' + LeadView.stageBadge(l.stage) + '</td>' +
      '<td data-label="Status">' + LeadView.statusBadge(l.status) + '</td>' +
      '<td data-label="Archived" class="arch-date">' + (l.archivedDate ? U.fmtDate(l.archivedDate) : '—') + '</td>' +
      '<td data-label="Notes"><span class="muted">' + U.esc((l.notes || '').slice(0, 80)) + '</span></td>' +
      '<td class="no-caption" data-label="" style="text-align:right;white-space:nowrap">' +
      '<button type="button" class="btn sm ghost archive-restore js-restore" data-id="' + U.esc(l.id) + '">' + ic('refresh') + ' Restore</button> ' +
      '<button type="button" class="btn sm danger archive-del js-del" data-id="' + U.esc(l.id) + '">' + ic('trash') + ' Delete</button>' +
      '</td></tr>'
    ).join('');
    tbody.querySelectorAll('tr').forEach(r => r.addEventListener('click', (e) => {
      if (e.target.closest('.js-restore') || e.target.closest('.js-del')) return;
      App.openLead(r.dataset.id);
    }));
    tbody.querySelectorAll('.js-restore').forEach(b => b.addEventListener('click', async () => {
      try { await db.leads.restore(b.dataset.id); App.toast('Lead restored to active views.', 'success'); }
      catch (e) { App.toast('Could not restore lead.', 'error'); }
    }));
    tbody.querySelectorAll('.js-del').forEach(b => b.addEventListener('click', async () => {
      const ok = await App.confirm({ title: 'Permanently delete ' + b.dataset.id + '?', message: 'All information and activities for this lead will be erased permanently.', danger: true, confirmLabel: 'Delete Permanently' });
      if (!ok) return;
      try {
        const acts = await db.activities.getByLead(b.dataset.id);
        for (const a of acts) await db.activities.remove(a.id);
        await db.leads.remove(b.dataset.id);
        App.toast('Lead deleted permanently.', 'success');
      } catch (e) { App.toast('Unable to delete lead.', 'error'); }
    }));
  }

  async function refreshData() {
    const all = await App.data('leads');
    App._cache.archCache = all.filter(l => l.archived);
    render();
  }

  function boot() {
    const cfg = App.config;
    const sel = document.getElementById('f-arch-stage');
    sel.innerHTML = '<option value="">All stages</option>' + cfg.stages.map(s => '<option>' + U.esc(s) + '</option>').join('');
    sel.addEventListener('change', (e) => { D.stage = e.target.value; render(); });
    document.getElementById('arch-search').addEventListener('input', U.debounce((e) => { D.q = e.target.value; render(); }, 150));
    document.querySelector('.js-export').addEventListener('click', () => {
      const list = App._cache.archCache || [];
      const rows = list.map(l => ({
        'Lead ID': l.id, 'Name': LeadView.customerName(l), 'Mobile': l.mobile || '', 'Vehicle': LeadView.vehicleLabel(l),
        'Stage': l.stage, 'Status': l.status, 'Priority': l.priority, 'Archived Date': l.archivedDate || '', 'Notes': l.notes || ''
      }));
      U.download('ToyotaCRM_Archived_' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
      App.toast('Archived leads exported.', 'success');
    });
    refreshData();
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:changed', (e) => { if (e.detail && e.detail.table === 'leads') refreshData(); });
})();