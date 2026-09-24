/* ============================================================
   Toyota CRM — leads.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const D = {
    q: '', status: '', stage: '', priority: '', source: '', chip: ''
  };
  const CHIPS = [
    { k: '', l: 'All', icon: '' },
    { k: 'Hot', l: 'Hot', icon: '' },
    { k: 'Warm', l: 'Warm', icon: '' },
    { k: 'Follow-up', l: 'Follow-up', icon: '' },
    { k: 'Due Today', l: 'Due Today', icon: '' },
    { k: 'Overdue', l: 'Overdue', icon: '' },
    { k: 'Released', l: 'Released', icon: '' },
    { k: 'Lost', l: 'Lost', icon: '' }
  ];

  function renderChips() {
    const el = document.getElementById('lead-chips');
    el.innerHTML = CHIPS.map(c => '<button type="button" class="chip' + (D.chip === c.k ? ' on' : '') + '" data-c="' + U.esc(c.k) + '">' + (c.icon ? ic(c.icon, '', 12) + ' ' : '') + U.esc(c.l) + '</button>').join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { D.chip = b.dataset.c; render(); }));
  }

  function matches(l, cfg) {
    if (D.q) {
      const hay = [l.id, l.name, l.companyName, l.mobile, l.email, l.vehicleInterest, l.variant, l.stage, l.status, l.priority, l.source, l.assignedTo, l.facebook, l.representative]
        .map(x => String(x || '').toLowerCase()).join(' ');
      if (hay.indexOf(D.q.toLowerCase()) === -1) return false;
    }
    if (D.status && l.status !== D.status) return false;
    if (D.stage && l.stage !== D.stage) return false;
    if (D.priority && l.priority !== D.priority) return false;
    if (D.source && l.source !== D.source) return false;
    if (D.chip === 'Hot' && l.priority !== 'Hot') return false;
    if (D.chip === 'Warm' && l.priority !== 'Warm') return false;
    if (D.chip === 'Follow-up' && !l.nextFollowupDate) return false;
    if (D.chip === 'Due Today' && l.nextFollowupDate !== U.todayISO()) return false;
    if (D.chip === 'Overdue' && !(l.nextFollowupDate && U.isPast(l.nextFollowupDate))) return false;
    if (D.chip === 'Released' && !db.leads.isReleased(l)) return false;
    if (D.chip === 'Lost' && !(l.status === 'Lost' || l.stage === 'Lost')) return false;
    return true;
  }

  function fuLabel(l) {
    if (!l.nextFollowupDate) return new LeadViewSm().no;
    const b = LeadView.fuBucket(l.nextFollowupDate);
    return '<span class="badge ' + (b.key === 'overdue' ? 'badge-overdue' : b.key === 'today' ? 'badge-warm' : 'badge-outline') + ' badge-sm">' + U.esc(b.label) + '</span>';
  }
  function LeadViewSm() { return { get no() { return '<span class="muted">—</span>'; } }; }

  function render() {
    const cfg = App.config;
    const leads = (App._cache.leadsCache || []);
    const list = leads.filter(l => !l.archived && matches(l, cfg));
    document.getElementById('lead-count').textContent = list.length + ' active lead' + (list.length === 1 ? '' : 's') + ' · ' + leads.length + ' total';
    const tbody = document.getElementById('lead-tbody');
    if (!list.length) {
      tbody.innerHTML = '';
      document.getElementById('lead-empty').classList.remove('hidden');
      document.getElementById('lead-table-wrap').classList.add('hidden');
      document.getElementById('lead-list').classList.add('hidden');
      return;
    }
    document.getElementById('lead-empty').classList.add('hidden');
    document.getElementById('lead-table-wrap').classList.remove('hidden');

    const rows = list.map(l => {
      const fu = l.nextFollowupDate;
      const fuCls = fu && U.isPast(fu) ? 'overdue' : (fu === U.todayISO() ? 'today' : '');
      return '<tr class="clickable" data-id="' + U.esc(l.id) + '">' +
        '<td><span class="lead-id">' + U.esc(l.id) + '</span></td>' +
        '<td><strong>' + U.esc(LeadView.customerName(l)) + '</strong>' +
        (l.assignedTo ? '<div class="muted small">' + U.esc(l.assignedTo) + '</div>' : '') + '</td>' +
        '<td data-label="Contact"><span class="nowrap">' + U.esc(l.mobile || (l.representativeMobile || '')) + '</span>' +
        (l.email ? '<div class="muted small">' + U.esc(l.email) + '</div>' : '') + '</td>' +
        '<td data-label="Vehicle">' + U.esc(LeadView.vehicleLabel(l)) + '</td>' +
        '<td data-label="Source"><span class="badge outline badge-sm">' + U.esc(l.source || '—') + '</span></td>' +
        '<td data-label="Stage">' + LeadView.stageBadge(l.stage) + '</td>' +
        '<td data-label="Status">' + LeadView.statusBadge(l.status) + '</td>' +
        '<td data-label="Priority">' + LeadView.priBadge(l.priority) + '</td>' +
        '<td data-label="Next follow-up">' +
        '<span class="duedate ' + fuCls + '">' + (fu ? U.fmtDate(fu, { short: true }) : '—') + '</span> ' + fuLabel(l) + '</td>' +
        '<td data-label="Next step"><span class="muted">' + U.esc(l.nextStep || '—') + '</span></td>' +
        '</tr>';
    }).join('');
    tbody.innerHTML = rows;
    tbody.querySelectorAll('tr').forEach(r => r.addEventListener('click', () => App.openLead(r.dataset.id)));

    // mobile cards
    const listEl = document.getElementById('lead-list');
    listEl.innerHTML = list.map(l => {
      const fu = l.nextFollowupDate;
      const fuCls = fu && U.isPast(fu) ? 'fu-overdue' : (fu === U.todayISO() ? 'fu-today' : 'fu-none');
      return '<div class="lead-card" data-id="' + U.esc(l.id) + '">' +
        '<div class="lc-top"><div><div class="lc-name">' + U.esc(LeadView.customerName(l)) + '</div>' +
        '<div class="lc-id mono">' + U.esc(l.id) + '</div></div>' + LeadView.priBadge(l.priority) + '</div>' +
        '<div class="lc-veh">' + ic('car', '', 13) + ' ' + U.esc(LeadView.vehicleLabel(l)) + '</div>' +
        '<div class="lc-row">' + LeadView.statusBadge(l.status) + LeadView.stageBadge(l.stage) + '</div>' +
        '<div class="lc-row"><span class="fu-chip ' + fuCls + '">' + (fu ? U.fmtDate(fu, { short: true }) : 'No follow-up') + '</span>' +
        (l.nextStep ? '<span class="muted small">' + U.esc(l.nextStep) + '</span>' : '') + '</div>' +
        '<div class="lc-meta"><span>' + U.esc(l.mobile || '—') + '</span><span>' + U.esc(l.source || '') + '</span></div>' +
        '</div>';
    }).join('');
    listEl.classList.remove('hidden');
    listEl.querySelectorAll('.lead-card').forEach(c => c.addEventListener('click', () => App.openLead(c.dataset.id)));
  }

  let booted = false;
  function init() {
    const cfg = App.config;
    const fill = (id, list, label) => {
      const sel = document.getElementById(id);
      sel.innerHTML = '<option value="">' + U.esc(label) + '</option>' + list.map(x => '<option>' + U.esc(x) + '</option>').join('');
    };
    fill('f-status', cfg.statuses, 'All statuses');
    fill('f-stage', cfg.stages, 'All stages');
    fill('f-priority', cfg.priorities, 'All priorities');
    fill('f-source', cfg.leadSources, 'All sources');
    renderChips();
    render();
  }

  async function refreshData() {
    const leads = await App.data('leads');
    App._cache.leadsCache = leads;
    render();
  }

  window.addEventListener('app:boot', () => {
    init();
    if (booted) return;
    booted = true;
    ['f-status', 'f-stage', 'f-priority', 'f-source'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const k = id.replace('f-', '');
        D[k] = e.target.value;
        render();
      });
    });
    document.getElementById('lead-search').addEventListener('input', U.debounce((e) => { D.q = e.target.value; render(); }, 150));
    document.querySelector('.js-add').addEventListener('click', () => App.addLead());
    document.querySelector('.js-export').addEventListener('click', () => {
      const list = (App._cache.leadsCache || []).filter(l => !l.archived);
      const rows = list.map(l => ({
        'Lead ID': l.id, 'Date Created': l.dateCreated, 'Lead Type': l.leadType, 'Name': LeadView.customerName(l),
        'Mobile': l.mobile || '', 'Email': l.email || '', 'Facebook': l.facebook || '', 'Lead Source': l.source || '',
        'Status': l.status || '', 'Pipeline Stage': l.stage || '', 'Priority': l.priority || '', 'Assigned To': l.assignedTo || '',
        'Last Contact': l.lastContactDate || '', 'Next Follow-up': l.nextFollowupDate || '', 'Next Step': l.nextStep || '',
        'Est. Purchase': l.estimatedPurchaseDate || '', 'Vehicle Interest': l.vehicleInterest || '',
        'Variant': l.variant || '', 'Color': l.color || '', 'Financing/Cash': l.financingCash || '', 'Notes': l.notes || ''
      }));
      U.download('ToyotaCRM_Leads_' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
      App.toast('Leads exported to CSV.', 'success');
    });

    const bootURL = new URL(location.href);
    if (bootURL.searchParams.get('add') === '1') {
      history.replaceState({}, '', bootURL.pathname);
      setTimeout(() => App.addLead(), 300);
    }
    refreshData();
  });
  document.addEventListener('crm:changed', (e) => { if (e.detail && e.detail.table === 'leads') refreshData(); });

  // touch refresh on crm:month so cache stays consistent
  document.addEventListener('crm:month', () => { App.data('leads'); });
})();
