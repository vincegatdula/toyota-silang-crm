/* ============================================================
   Toyota CRM — app.js
   Application shell: chrome/navigation, month selector,
   modal/toast system, global search, theme, PWA, demo seed.
   ============================================================ */
(function (global) {
  'use strict';
  const U = global.Utils;
  const db = global.db;

  /* ============================ ICONS ============================ */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    leads: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    kanban: '<path d="M3 3h18v18H3z"/><path d="M9 8h6v9H9z"/><path d="M3 8h6M15 8h6M3 17h6M15 17h6"/>',
    activities: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    targets: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    reports: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    archive: '<path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5"/><path d="M10 12h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    chevL: '<path d="M15 18l-6-6 6-6"/>',
    chevR: '<path d="M9 18l6-6-6-6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    car: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18a1 1 0 0 1 1 1v4h-2a3 3 0 1 1-6 0H10a3 3 0 1 1-6 0H2v-4a1 1 0 0 1 1-1z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
  };
  function icon(name, cls, size) {
    return '<svg class="' + (cls || 'icon') + '" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ============================ STATE ============================ */
  const NAV = [
    { href: 'dashboard.html', page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: 'leads.html', page: 'leads', label: 'Leads', icon: 'leads' },
    { href: 'kanban.html', page: 'kanban', label: 'Kanban', icon: 'kanban' },
    { href: 'activities.html', page: 'activities', label: 'Activities', icon: 'activities' },
    { href: 'calendar.html', page: 'calendar', label: 'Calendar', icon: 'calendar' },
    { href: 'targets.html', page: 'targets', label: 'Targets', icon: 'targets' },
    { href: 'reports.html', page: 'reports', label: 'Reports', icon: 'reports' },
    { href: 'archived.html', page: 'archived', label: 'Archived Leads', icon: 'archive' },
    { href: 'settings.html', page: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const App = {
    ICONS, icon,
    config: null,
    month: U.currentMonthKey(),
    page: document.body.getAttribute('data-page') || 'dashboard',
    sidebarCollapsed: localStorage.getItem('crm:sidebar') === '1',
    theme: localStorage.getItem('crm:theme') === 'dark' ? 'dark' : 'light',

    /* ---------------- data cache ---------------- */
    _cache: {},
    data(table) {
      if (!this._cache[table]) {
        const map = { leads: () => db.leads.getAll(), activities: () => db.activities.getAll(), targets: () => db.targets.getAll(), holidays: () => db.holidays.getAll() };
        const p = map[table] ? map[table]() : Promise.resolve([]);
        this._cache[table] = p;
        // evict failed reads so the next attempt re-queries instead of
        // serving a permanently-rejected promise
        p.catch(() => { delete this._cache[table]; });
      }
      return this._cache[table];
    },
    invalidate(table) {
      if (table === 'settings') { this._cache = {}; return; }
      delete this._cache[table];
    },

    /* ---------------- resilient load + user-facing errors ---------------- */
    async load(table) {
      try { return await this.data(table); }
      catch (e) {
        console.error('Failed to load ' + table, e);
        this.onError('Could not read ' + table + ' from local storage. If this keeps happening, make sure browser storage (IndexedDB) is enabled and not blocked.');
        return [];
      }
    },
    onError(msg) {
      const root = document.getElementById('error-banner');
      if (!root) return;
      root.classList.remove('hidden');
      root.innerHTML =
        icon('alert', 'ic', 15) +
        '<span class="err-msg">' + U.esc(msg) + '</span>' +
        '<button type="button" class="btn icon ghost sm js-dismiss" aria-label="Dismiss error">' + icon('x') + '</button>';
      root.querySelector('.js-dismiss').addEventListener('click', () => root.classList.add('hidden'));
    },

    /* ---------------- month selector ---------------- */
    setMonth(mk, { persist = true } = {}) {
      this.month = mk;
      if (persist) localStorage.setItem('crm:month', mk);
      const lbl = document.getElementById('month-label');
      if (lbl) lbl.textContent = U.monthLabel(mk);
      document.dispatchEvent(new CustomEvent('crm:month', { detail: { month: mk } }));
    },

    /* ---------------- theme ---------------- */
    setTheme(mode) {
      this.theme = mode;
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('crm:theme', mode);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.innerHTML = this.theme === 'dark' ? icon('sun') : icon('moon');
    },

    /* ---------------- toast ---------------- */
    toast(msg, type) {
      const t = document.createElement('div');
      t.className = 'toast toast-' + (type || 'info');
      t.setAttribute('role', 'status');
      t.innerHTML = icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info') + '<span>' + U.esc(msg) + '</span>';
      document.getElementById('toast-root').appendChild(t);
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
    },

    /* ---------------- confirm ---------------- */
    confirm({ title = 'Are you sure?', message = '', danger = false, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
      return new Promise((resolve) => {
        const root = document.getElementById('modal-root');
        const ov = document.createElement('div');
        ov.className = 'modal-overlay';
        ov.innerHTML =
          '<div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="' + U.esc(title) + '">' +
          '<div class="modal-head"><h3>' + U.esc(title) + '</h3></div>' +
          '<div class="modal-body"><p class="muted">' + U.esc(message) + '</p></div>' +
          '<div class="modal-foot">' +
          '<button type="button" class="btn ghost js-cancel">' + U.esc(cancelLabel) + '</button>' +
          '<button type="button" class="btn ' + (danger ? 'danger' : 'primary') + ' js-ok">' + U.esc(confirmLabel) + '</button>' +
          '</div></div>';
        root.appendChild(ov);
        const close = (v) => { ov.remove(); resolve(v); };
        ov.querySelector('.js-cancel').addEventListener('click', () => close(false));
        ov.querySelector('.js-ok').addEventListener('click', () => close(true));
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(false); });
      });
    },

    /* ---------------- generic modal ---------------- */
    modal({ title, content, footer, size = 'md', onClose }) {
      const root = document.getElementById('modal-root');
      const existing = root.querySelector('.modal');
      if (existing) existing.parentElement.remove();
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML =
        '<div class="modal modal-' + size + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + U.esc(title) + '</h3>' +
        '<button type="button" class="btn icon ghost js-close" aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="modal-body js-body"></div>' +
        (footer ? '<div class="modal-foot">' + footer + '</div>' : '') +
        '</div>';
      root.appendChild(ov);
      const body = ov.querySelector('.js-body');
      if (typeof content === 'string') body.innerHTML = content;
      else body.appendChild(content);
      ov.querySelector('.js-close').addEventListener('click', () => closeModal());
      ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
      function closeModal() {
        ov.remove();
        if (typeof onClose === 'function') onClose();
        document.removeEventListener('keydown', onKey);
      }
      function onKey(e) { if (e.key === 'Escape') closeModal(); }
      document.addEventListener('keydown', onKey);
      return ov;
    },
    closeModal() {
      const ov = document.getElementById('modal-root').querySelector('.modal-overlay');
      if (ov) ov.remove();
    },

    /* ---------------- global search ---------------- */
    openSearch() {
      const lbl = (l) => l.name || (l.leadType === 'corporate' ? l.companyName : '');
      this.modal({
        title: 'Search Leads', size: 'lg',
        content:
          '<div class="search-box"><span class="search-ic">' + icon('search') + '</span>' +
          '<input type="search" id="g-search-input" placeholder="Search by ID, name, mobile, vehicle, status, stage, priority, source…" autocomplete="off">' +
          '</div>' +
          '<div class="chip-row" id="g-search-filters"></div>' +
          '<div class="search-results" id="g-search-results"></div>',
        footer: '<span class="muted small">Press Esc to close</span>'
      });
      const input = document.getElementById('g-search-input');
      const results = document.getElementById('g-search-results');
      const filters = document.getElementById('g-search-filters');
      const chips = ['Active', 'Archived', 'Hot', 'Warm', 'Follow-up', 'Due Today', 'Overdue', 'Released', 'Lost'];
      const activeFilter = { v: '' };
      filters.innerHTML = chips.map(c => '<button type="button" class="chip" data-f="' + c + '">' + c + '</button>').join('');
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('.chip');
        if (!b) return;
        const val = b.dataset.f;
        activeFilter.v = activeFilter.v === val ? '' : val;
        filters.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x.dataset.f === activeFilter.v));
        run();
      });
      const run = U.debounce(async () => {
        const q = (input.value || '').trim().toLowerCase();
        let leads = await App.data('leads');
        leads = leads.filter(l => {
          if (activeFilter.v === 'Active' && l.archived) return false;
          if (activeFilter.v === 'Archived' && !l.archived) return false;
          if (activeFilter.v === 'Hot' && l.priority !== 'Hot') return false;
          if (activeFilter.v === 'Warm' && l.priority !== 'Warm') return false;
          if (activeFilter.v === 'Follow-up' && !l.nextFollowupDate) return false;
          if (activeFilter.v === 'Due Today' && l.nextFollowupDate !== U.todayISO()) return false;
          if (activeFilter.v === 'Overdue' && !(l.nextFollowupDate && U.isPast(l.nextFollowupDate))) return false;
          if (activeFilter.v === 'Released' && !db.leads.isReleased(l)) return false;
          if (activeFilter.v === 'Lost' && !(l.status === 'Lost' || l.stage === 'Lost')) return false;
          if (!q) return true;
          const hay = [l.id, lbl(l), l.mobile, l.email, l.vehicleInterest, l.variant, l.status, l.stage, l.priority, l.source, l.assignedTo, l.facebook, l.companyName, l.representative]
            .map(x => String(x || '').toLowerCase()).join(' ');
          return hay.indexOf(q) !== -1;
        });
        if (!leads.length) { results.innerHTML = '<div class="empty">No leads match.</div>'; return; }
        results.innerHTML = leads.slice(0, 60).map(l =>
          '<button type="button" class="lead-search-row" data-id="' + U.esc(l.id) + '">' +
          '<span class="lead-search-id">' + U.esc(l.id) + '</span>' +
          '<span class="lead-search-name">' + U.esc(lbl(l)) + '</span>' +
          '<span class="muted">' + U.esc(l.mobile || '—') + '</span>' +
          '<span class="muted">' + U.esc(l.vehicleInterest || '') + '</span>' +
          '<span class="badge badge-' + U.esc(String(l.status).toLowerCase().replace(/\s+/g, '-')) + '">' + U.esc(l.status) + '</span>' +
          '<span class="badge ' + (l.archived ? 'badge-archived' : '') + (U.isPast(l.nextFollowupDate) && l.nextFollowupDate ? ' badge-overdue' : '') + '">' + U.esc(l.stage) + '</span>' +
          '</button>'
        ).join('');
        results.querySelectorAll('.lead-search-row').forEach(r => {
          r.addEventListener('click', () => {
            const id = r.dataset.id;
            App.closeModal();
            App.openLead(id);
          });
        });
      }, 150);
      input.addEventListener('input', run);
      input.focus();
      run();
    },

    /* ---------------- open lead (delegated to leadview.js) ---------------- */
    openLead(id) {
      if (global.LeadView && typeof global.LeadView.open === 'function') global.LeadView.open(id);
      else location.href = 'leads.html?open=' + encodeURIComponent(id);
    },

    /* ---------------- quick add ---------------- */
    addLead() {
      if (global.LeadView && typeof global.LeadView.openAdd === 'function') global.LeadView.openAdd();
      else location.href = 'leads.html?add=1';
    },

    /* ---------------- seed demo data ---------------- */
    async seedDemoData() {
      const cfg = db.getConfig();
      if (cfg.seeded) return false;
      const today = U.todayISO();
      const mk = U.currentMonthKey();
      const [y, m] = mk.split('-').map(Number);
      const dIn = (day) => y + '-' + ('0' + m).slice(-2) + '-' + ('0' + day).slice(-2);

      const L = (o) => db.leads.create(o);
      await L({ leadType: 'individual', name: 'Juan Dela Cruz', mobile: '09171234567', email: 'juan.dc@gmail.com', facebook: 'juan.delacruz', source: 'Facebook', status: 'Hot', stage: 'Quotation', priority: 'Hot', assignedTo: 'M. Santos', vehicleInterest: 'Hilux', variant: '2.8 LTD', color: 'White', budget: '1818000', downPayment: '400000', estimatedMonthly: '38000', financingCash: 'Financing', nextFollowupDate: today, nextStep: 'Send final quotation and bank options', estimatedPurchaseDate: U.addDays(today, 12), lastContactDate: U.addDays(today, -1), notes: 'Interested in Hilux 2.8 LTD, planning to replace company vehicle. (Demo data)', dateCreated: dIn(3) });
      await L({ leadType: 'individual', name: 'Maria Reyes', mobile: '09181234567', email: 'maria.reyes@yahoo.com', source: 'Walk-in', status: 'Test Drive', stage: 'Test Drive', priority: 'Warm', assignedTo: 'M. Santos', vehicleInterest: 'Corolla Cross', variant: 'G', color: 'Silver', budget: '1385000', downPayment: '300000', estimatedMonthly: '24000', financingCash: 'Financing', testDriveDate: U.addDays(today, 1), testDriveNotes: 'Morning test drive scheduled', nextFollowupDate: U.addDays(today, 1), nextStep: 'Test drive + payment computation', lastContactDate: today, dateCreated: dIn(5) });
      await L({ leadType: 'individual', name: 'Robert Lim', mobile: '09192345678', email: 'robert.lim@outlook.com', source: 'Referral', status: 'New', stage: 'New Lead', priority: 'Cold', assignedTo: '', vehicleInterest: 'Vios', variant: 'E', color: 'White', budget: '873000', financingCash: 'Cash', nextFollowupDate: U.addDays(today, 3), nextStep: 'Introduce models and pricing', lastContactDate: today, dateCreated: today, notes: 'Referred by a previous client. (Demo data)' });
      await L({ leadType: 'corporate', companyName: 'AGS Logistics Inc.', name: 'Dr. Anton Garcia', representative: 'Anton Garcia', representativePosition: 'Fleet Manager', representativeMobile: '09175551234', representativeEmail: 'anton@agslogistics.ph', companyAddress: 'Carmona, Cavite', companyTin: '123-456-789-000', industry: 'Logistics', yearsInBusiness: 8, fleetSize: 24, companyTelephone: '(046) 123-4567', source: 'Phone', status: 'Financing', stage: 'Financing Application', priority: 'Hot', assignedTo: 'R. Tan', vehicleInterest: 'Hilux', variant: '2.8 LTD', color: 'Grey', budget: '1818000', downPayment: '600000', estimatedMonthly: '33000', financingCash: 'Financing', purpose: 'Business / Work', nextFollowupDate: U.addDays(today, 2), nextStep: 'Submit fleet financing documents', estimatedPurchaseDate: U.addDays(today, 18), lastContactDate: U.addDays(today, -2), dateCreated: dIn(8) });
      await L({ leadType: 'individual', name: 'Sarah Mendoza', mobile: '09181112233', email: 'sarah.mendoza@gmail.com', source: 'TikTok', status: 'Warm', stage: 'Vehicle Presentation', priority: 'Warm', assignedTo: 'M. Santos', vehicleInterest: 'Raize', variant: '1.2 G', color: 'Red', budget: '902000', estimatedMonthly: '18000', financingCash: 'Financing', nextFollowupDate: U.addDays(today, 4), nextStep: 'Show vehicle in showroom', lastContactDate: U.addDays(today, -3), dateCreated: dIn(9) });
      await L({ leadType: 'individual', name: 'Engr. Noel Ramirez', mobile: '09173456789', email: 'noel.ramirez@yahoo.com', source: 'Website', status: 'Released', stage: 'After-Sales', priority: 'Cold', assignedTo: 'R. Tan', vehicleInterest: 'Innova', variant: '2.8 E', color: 'Black', budget: '1398000', financingCash: 'Financing', releaseDate: U.addDays(today, -60), orcrStatus: 'Released', plateNumber: 'NBS 2341', plateDate: U.addDays(today, -20), nextFollowupDate: '', nextStep: 'After-sales follow-up', dateCreated: dIn(1), notes: 'Unit released (demo data). Post-release: OR/CR released, plate ongoing.' });
      await L({ leadType: 'corporate', companyName: 'GreenFields Trading', name: 'Victor Cruz', representative: 'Victor Cruz', representativePosition: 'Owner', representativeMobile: '09184445566', representativeEmail: 'victor@greenfields.ph', companyTin: '987-654-321-000', industry: 'Retail', yearsInBusiness: 5, fleetSize: 6, source: 'Messenger', status: 'Approved', stage: 'Approval', priority: 'Hot', assignedTo: 'R. Tan', vehicleInterest: 'Rush', variant: '1.5 G', color: 'White', budget: '1120000', downPayment: '350000', estimatedMonthly: '21000', financingCash: 'Financing', nextFollowupDate: U.addDays(today, 2), nextStep: 'Await bank approval confirmation', estimatedPurchaseDate: U.addDays(today, 9), lastContactDate: U.addDays(today, -1), dateCreated: dIn(4) });
      await L({ leadType: 'individual', name: 'Dennis Aquino', mobile: '09175677889', email: 'dennis.aq@hotmail.com', source: 'Existing Client', status: 'Reserved', stage: 'Reservation', priority: 'Warm', assignedTo: 'M. Santos', vehicleInterest: 'Fortuner', variant: '2.4 G', color: 'Grey', budget: '2025000', downPayment: '500000', estimatedMonthly: '41000', financingCash: 'Financing', reservationStatus: 'Reserved', reservationDate: U.addDays(today, -3), reservationAmount: '50000', nextFollowupDate: U.addDays(today, 5), nextStep: 'Schedule payment and release', estimatedPurchaseDate: U.addDays(today, 15), lastContactDate: U.addDays(today, -3), dateCreated: dIn(10) });
      await L({ leadType: 'individual', name: 'Liza Fernandez', mobile: '09199456677', email: 'liza.fernandez@gmail.com', source: 'Facebook', status: 'Lost', stage: 'Lost', priority: 'Cold', assignedTo: '', vehicleInterest: 'Wigo', variant: '1.0 E', color: 'Blue', budget: '688000', financingCash: 'Cash', nextFollowupDate: '', nextStep: 'Revisit in Q1 next year', lastContactDate: U.addDays(today, -20), dateCreated: dIn(2), notes: 'Chose to postpone purchase. (Demo data)' });
      await L({ leadType: 'individual', name: 'Paolo Villanueva', mobile: '09181239876', email: 'paolo.v@gmail.com', source: 'Walk-in', status: 'Follow-up', stage: 'Needs Analysis', priority: 'Warm', assignedTo: 'M. Santos', vehicleInterest: 'Veloz', variant: '1.5 V', color: 'Silver', budget: '1180000', estimatedMonthly: '23000', financingCash: 'Financing', nextFollowupDate: U.addDays(today, -1), nextStep: 'Confirm family requirements and budget', lastContactDate: U.addDays(today, -6), dateCreated: dIn(6), notes: 'Follow-up overdue. (Demo data)' });
      await L({ leadType: 'individual', name: 'Carlo Torres', mobile: '09193334455', email: 'carlo.torres@yahoo.com', source: 'Phone', status: 'Contacted', stage: 'Contacted', priority: 'Cold', assignedTo: 'R. Tan', vehicleInterest: 'Hiace', variant: '2.8 GL', color: 'White', budget: '2388000', financingCash: 'Financing', nextFollowupDate: U.addDays(today, 6), nextStep: 'Discuss Hiace specs and fleet options', lastContactDate: U.addDays(today, -4), dateCreated: dIn(7) });
      await L({ leadType: 'individual', name: 'Grace Bautista', mobile: '09197778899', email: 'grace.bautista@gmail.com', birthdate: '1995-03-14', source: 'Referral', status: 'New', stage: 'New Lead', priority: 'Warm', assignedTo: '', vehicleInterest: 'Wigo', variant: '1.0 G', color: 'Red', budget: '721000', financingCash: 'Cash', nextFollowupDate: U.addDays(today, 9), nextStep: 'Send brochure and price list', lastContactDate: '', dateCreated: dIn(11), notes: 'First time buyer. (Demo data)' });

      const acts = [
        { leadId: '', type: 'Follow-up', activityDate: today, dueDate: today, completed: false, notes: 'Send final quotation to Juan Dela Cruz', nextStep: 'Confirm bank options' },
        { leadId: '', type: 'Test Drive', activityDate: today, dueDate: U.addDays(today, 1), completed: false, notes: 'Test drive for Maria Reyes at 10:00 AM' },
        { leadId: '', type: 'Call', activityDate: U.addDays(today, -1), dueDate: U.addDays(today, -1), completed: true, completedDate: U.addDays(today, -1), notes: 'Initial call with Anton Garcia', outcome: 'Fleet deal confirmed, documents pending' },
        { leadId: '', type: 'Payment', activityDate: U.addDays(today, 6), dueDate: U.addDays(today, 6), completed: false, notes: 'Schedule down payment for Dennis Aquino' }
      ];
      const allLeads = await db.leads.getAll();
      const ant = allLeads.find(l => (l.name || '').indexOf('Anton') !== -1) || allLeads[0];
      const leadFor = [0, 1, 3].map(i => allLeads[i]); // juan, maria, dennis
      leadFor[2] = allLeads.find(l => (l.name || '').indexOf('Dennis') !== -1) || allLeads[0];
      const attach = [0, 1, 3];
      for (let i = 0; i < acts.length; i++) {
        const a = acts[i];
        const base = attach.includes(i) ? leadFor[i === 2 ? 0 : (i === 3 ? 2 : i)] : ant;
        await db.activities.create(Object.assign({}, a, { leadId: base ? base.id : '', leadName: base ? base.name : a.notes }));
      }

      // targets for current + next month
      const leadTargets = {};
      cfg.leadSources.forEach((s, i) => leadTargets[s] = [8, 6, 4, 5, 4, 6, 4, 3, 2][i] || 3);
      await db.targets.set(mk, { salesTarget: 5, leadTargets, workingDays: 22, closingRatio: 25 });
      await db.targets.set(U.addMonths(mk, 1), { salesTarget: 6, leadTargets, workingDays: 22, closingRatio: 25 });

      // holidays (Philippines, 4Q 2026 + some)
      const hol = [
        ['Bonifacio Day', dIn(30)],
        ['Christmas Day', y + '-12-25'],
        ['Rizal Day', y + '-12-30'],
        ['New Year', y + '-12-31']
      ];
      const existingHol = await db.holidays.getAll();
      for (const [name, date] of hol) {
        if (!existingHol.some(h => h.date === date)) await db.holidays.add(name, date);
      }

      await db.settings.update({ seeded: true, demoData: true });
      this.invalidate();
      return true;
    },

    /* ---------------- init ---------------- */
    async init() {
      try {
        await db.ready;
      } catch (e) {
        console.error('IndexedDB unavailable', e);
        this.buildChrome();
        this.onError('Local storage (IndexedDB) could not be opened, so data cannot be saved or loaded. Check that browser storage is enabled and not blocked, then reload.');
        this.setTheme(this.theme);
        this.registerServiceWorker();
        window.dispatchEvent(new CustomEvent('app:boot', { bubbles: true }));
        return;
      }
      this.config = db.getConfig();
      document.documentElement.setAttribute('data-theme', this.theme);
      const savedMonth = localStorage.getItem('crm:month');
      if (savedMonth && /^\d{4}-\d{2}$/.test(savedMonth)) this.month = savedMonth;

      this.buildChrome();
      this.setTheme(this.theme);
      this.setMonth(this.month, { persist: false });
      this.bindGlobal();

      if (!this.config.seeded) {
        await this.seedDemoData();
        if (this.config.demoData) App.toast('Sample data loaded. You can clear it in Settings → Data.', 'info');
      }
      this.registerServiceWorker();
      window.dispatchEvent(new CustomEvent('app:boot', { bubbles: true }));
    },

    buildChrome() {
      const body = document.body;
      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar' + (this.sidebarCollapsed ? ' collapsed' : '');
      sidebar.id = 'app-sidebar';
      sidebar.setAttribute('aria-label', 'Main navigation');

      const brand = '<a class="brand" href="dashboard.html">' +
        '<span class="brand-mark" aria-hidden="true">T</span>' +
        '<span class="brand-text"><strong>TOYOTA</strong><em>CRM</em></span>' +
        '</a>';
      const nav = NAV.map(n =>
        '<a class="nav-item' + (n.page === this.page ? ' active' : '') + '" href="' + n.href + '" data-nav="' + n.page + '">' +
        icon(n.icon) + '<span class="nav-label">' + n.label + '</span></a>'
      ).join('');
      const footer = '<div class="sidebar-foot">' +
        '<div class="storage-note">' + icon('clock') + '<span class="nav-label">Data stored locally<br><small>IndexedDB · this device</small></span></div>' +
        '<button type="button" class="nav-item js-collapse" aria-label="Toggle sidebar">' + icon('chevL') + '<span class="nav-label">Collapse</span></button>' +
        '</div>';
      sidebar.innerHTML = '<div class="sidebar-inner"><button type="button" class="sidebar-x js-sideclose" aria-label="Close menu">' + icon('x') + '</button>' + brand + '<nav class="nav">' + nav + '</nav>' + footer + '</div>';
      body.insertBefore(sidebar, body.firstChild);
      document.body.classList.add('has-sidebar');
      if (this.sidebarCollapsed) document.body.classList.add('sidebar-collapsed');

      const topbar = document.createElement('header');
      topbar.className = 'topbar';
      const pageNav = NAV.find(n => n.page === this.page) || {};
      topbar.innerHTML =
        '<button type="button" class="btn icon ghost js-menu" aria-label="Menu" aria-expanded="false">' + icon('menu') + '</button>' +
        '<h1 class="page-title">' + U.esc((pageNav.label) || '') + '</h1>' +
        '<div class="topbar-spacer"></div>' +
        '<div class="month-select" aria-label="Selected month">' +
        '<button type="button" class="btn icon ghost js-mprev" aria-label="Previous month">' + icon('chevL') + '</button>' +
        '<button type="button" class="month-label" id="month-label"></button>' +
        '<button type="button" class="btn icon ghost js-mnext" aria-label="Next month">' + icon('chevR') + '</button>' +
        '<button type="button" class="btn ghost js-mtoday">Today</button>' +
        '</div>' +
        '<button type="button" class="btn icon ghost js-search" aria-label="Search leads">' + icon('search') + '</button>' +
        '<button type="button" class="btn icon ghost js-theme" id="theme-toggle" aria-label="Toggle theme"></button>' +
        '<span class="online-dot js-online" title=""></span>' +
        '<button type="button" class="btn primary add-lead js-addlead"><span class="pplus">' + icon('plus') + '</span>Add Lead</button>';
      const main = body.querySelector('main.content') || document.createElement('main');
      body.insertBefore(topbar, main);

      const banner = document.createElement('div');
      banner.className = 'error-banner hidden';
      banner.id = 'error-banner';
      banner.setAttribute('role', 'alert');
      main.prepend(banner);

      const scrim = document.createElement('div');
      scrim.className = 'sidebar-scrim';
      scrim.id = 'sidebar-scrim';
      body.appendChild(scrim);

      const toastRoot = document.createElement('div');
      toastRoot.className = 'toast-root';
      toastRoot.id = 'toast-root';
      body.appendChild(toastRoot);
      const modalRoot = document.createElement('div');
      modalRoot.id = 'modal-root';
      body.appendChild(modalRoot);

      /* Thumb-friendly bottom navigation (mobile only — hidden on desktop). */
      const mnav = document.createElement('nav');
      mnav.className = 'mobile-nav';
      mnav.setAttribute('aria-label', 'Main navigation');
      const mItems = NAV.filter(n => ['dashboard', 'leads', 'kanban', 'activities', 'calendar'].indexOf(n.page) !== -1);
      mnav.innerHTML = mItems.map(n =>
        '<a class="mnav-item' + (n.page === this.page ? ' active' : '') + '" href="' + n.href + '" data-nav="' + n.page + '">' +
        icon(n.icon, 'ic', 20) + '<span>' + n.label + '</span></a>'
      ).join('');
      body.appendChild(mnav);
    },

    bindGlobal() {
      const sb = document.getElementById('app-sidebar');
      const scrim = document.getElementById('sidebar-scrim');
      const isOffCanvas = () => window.matchMedia('(max-width: 1024px)').matches;
      const sideOpen = () => sb.classList.contains('side-open');
      const toggleClass = (has) => {
        /* The drawer only ever exists when the sidebar is off-canvas.
           Guarding keeps the scrim from dimming desktop layouts. */
        const want = !!has && isOffCanvas();
        sb.classList.toggle('side-open', want);
        scrim.classList.toggle('show', want);
        const m = document.querySelector('.js-menu');
        if (m) m.setAttribute('aria-expanded', want ? 'true' : 'false');
      };
      const closeSide = () => toggleClass(false);
      document.querySelector('.js-menu').addEventListener('click', () => toggleClass(!sideOpen()));
      const sideClose = document.querySelector('.js-sideclose');
      if (sideClose) sideClose.addEventListener('click', () => closeSide());
      scrim.addEventListener('click', () => closeSide());
      document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => { if (sideOpen()) closeSide(); });
      });
      /* The Collapse control has its OWN listener below. It must not inherit
         the generic nav-item binding, or collapse would toggle twice per click
         (open + close = no visible change). */
      document.querySelector('.js-collapse').addEventListener('click', (e) => { e.preventDefault(); this.toggleCollapse(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sideOpen()) closeSide(); });
      window.addEventListener('resize', () => { if (!isOffCanvas() && sideOpen()) closeSide(); });
      const mprev = document.querySelector('.js-mprev');
      const mnext = document.querySelector('.js-mnext');
      const mtoday = document.querySelector('.js-mtoday');
      mprev.addEventListener('click', () => this.setMonth(U.addMonths(this.month, -1)));
      mnext.addEventListener('click', () => this.setMonth(U.addMonths(this.month, 1)));
      mtoday.addEventListener('click', () => this.setMonth(U.currentMonthKey()));
      document.querySelector('.js-search').addEventListener('click', () => this.openSearch());
      document.querySelector('.js-theme').addEventListener('click', () => this.setTheme(this.theme === 'dark' ? 'light' : 'dark'));
      const addBtn = document.querySelector('.js-addlead');
      if (addBtn) addBtn.addEventListener('click', () => this.addLead());

      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));
      this.setOnline(navigator.onLine);

      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openSearch(); }
      });
      window.addEventListener('app:boot', () => {
        const url = new URL(location.href);
        if (url.searchParams.get('open')) {
          const id = url.searchParams.get('open');
          history.replaceState({}, '', url.pathname);
          setTimeout(() => this.openLead(id), 400);
        }
      });
    },
    toggleCollapse() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem('crm:sidebar', this.sidebarCollapsed ? '1' : '0');
      document.body.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
      const sb = document.getElementById('app-sidebar');
      if (sb) sb.classList.toggle('collapsed', this.sidebarCollapsed);
    },
    setOnline(on) {
      const dot = document.querySelector('.js-online');
      if (!dot) return;
      dot.classList.toggle('off', !on);
      dot.title = on ? 'Online' : 'Offline — working from local data';
    },
    registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      if (!/^https?:$/.test(location.protocol)) return;
      navigator.serviceWorker.register(location.pathname.replace(/[^/]*$/, '') + 'sw.js').catch(() => {});
    }
  };

  global.App = App;

  /* Invalidate the shared data cache BEFORE any page-level 'crm:changed'
     listener runs, so listeners that re-read via App.data never snapshot a
     stale (pre-write) promise. Registered at module load so it always
     precedes listeners registered by page modules. */
  document.addEventListener('crm:changed', (e) => {
    App.invalidate(e.detail && e.detail.table);
  });

  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);