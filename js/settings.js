/* ============================================================
   Toyota CRM — settings.js
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const LIST_KEYS = {
    sources: 'leadSources', statuses: 'statuses', stages: 'stages',
    priorities: 'priorities', acttypes: 'activityTypes',
    vehicles: 'vehicleModels', variants: 'vehicleVariants', colors: 'vehicleColors'
  };
  const LIST_LABELS = {
    sources: 'Lead source', statuses: 'Status', stages: 'Stage',
    priorities: 'Priority', acttypes: 'Activity type',
    vehicles: 'Vehicle model', variants: 'Variant', colors: 'Color'
  };

  function renderList(key, label) {
    const cfg = App.config;
    const list = cfg[LIST_KEYS[key]] || [];
    const el = document.getElementById('l-' + key);
    const rows = list.map((v, i) =>
      '<div class="set-item">' +
      (key === 'stages'
        ? '<button type="button" class="btn icon ghost sm js-move" data-key="' + key + '" data-i="' + i + '" data-d="-1" aria-label="Move up">' + ic('chevL') + '</button>' +
          '<button type="button" class="btn icon ghost sm js-move" data-key="' + key + '" data-i="' + i + '" data-d="1" aria-label="Move down">' + ic('chevR') + '</button>'
        : '') +
      '<span class="txt strong">' + U.esc(v) + '</span>' +
      '<button type="button" class="btn icon ghost sm js-remove" data-key="' + key + '" data-v="' + U.esc(v) + '" aria-label="Remove">' + ic('x') + '</button>' +
      '</div>'
    ).join('');
    el.innerHTML = rows +
      '<div class="add-row"><input type="text" id="in-' + key + '" placeholder="Add ' + U.esc(LIST_LABELS[key]) + '…" aria-label="Add ' + U.esc(LIST_LABELS[key]) + '">' +
      '<button type="button" class="btn primary js-add" data-key="' + key + '">Add</button></div>';
  }

  async function updateList(key, fn) {
    const cfg = App.config;
    const k = LIST_KEYS[key];
    const next = fn([].concat(cfg[k] || []));
    try {
      await db.settings.update({ [k]: next });
      App.toast('Saved.', 'success');
      bootState(); // re-render this page
    } catch (e) { App.toast('Unable to save.', 'error'); }
  }

  function bootState() {
    App.config = db.getConfig();
    Object.keys(LIST_KEYS).forEach(k => renderList(k));
    renderHolidays();
    fillGeneral();
  }

  function fillGeneral() {
    const c = App.config;
    document.getElementById('g-dealer').value = c.dealerName || '';
    document.getElementById('g-salesperson').value = c.salesperson || '';
    document.getElementById('g-wd').value = c.workingDays || '';
    document.getElementById('g-cr').value = c.closingRatio || '';
    document.getElementById('g-dst').value = c.defaultSalesTarget || '';
  }

  async function renderHolidays() {
    const h = await db.holidays.getAll();
    const el = document.getElementById('l-holidays');
    el.innerHTML = h.map(x =>
      '<div class="set-item"><span class="txt"><strong>' + U.esc(x.name) + '</strong><small>' + U.fmtDate(x.date) + '</small></span>' +
      '<button type="button" class="btn icon ghost sm js-delhol" data-d="' + x.date + '" aria-label="Remove holiday">' + ic('trash') + '</button></div>'
    ).join('') || '<div class="empty" style="padding:12px">No holidays configured.</div>';
    el.querySelectorAll('.js-delhol').forEach(b => b.addEventListener('click', async () => {
      await db.holidays.remove(b.dataset.d);
      renderHolidays();
    }));
  }

  async function saveBackup() {
    try {
      const backup = await db.exportBackup();
      U.download('ToyotaCRM_Backup_' + U.todayISO() + '.json', JSON.stringify(backup, null, 2), 'application/json');
      App.toast('Backup exported. Keep it safe.', 'success');
    } catch (e) { App.toast('Unable to export backup.', 'error'); }
  }

  async function importBackupFile(file) {
    let obj;
    try { obj = JSON.parse(await file.text()); }
    catch (e) { App.toast('Invalid backup file: not valid JSON.', 'error'); return; }
    const vErr = await db.importValidation(obj);
    if (vErr) { App.toast('Invalid backup file: ' + vErr, 'error'); return; }
    const leadCount = ((obj.data || obj).leads || []).length;
    const ok = await App.confirm({
      title: 'Import backup?',
      message: 'This will replace all current data in this browser with the backup (' + leadCount + ' leads). This cannot be undone. Continue?',
      danger: true, confirmLabel: 'Replace & Import'
    });
    if (!ok) return;
    try {
      await db.importBackup(obj, { replace: true });
      App.toast('Backup imported successfully.', 'success');
      App.invalidate();
      bootState();
    } catch (e) {
      App.toast('Could not import backup: ' + (e && e.message || 'unknown error'), 'error');
      console.error(e);
    }
  }

  function boot() {
    bootState();

    // nav
    document.getElementById('set-nav').addEventListener('click', (e) => {
      const b = e.target.closest('.sn');
      if (!b) return;
      document.querySelectorAll('.sn').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.set-panel section').forEach(s => s.classList.toggle('hidden', s.id !== 'p-' + b.dataset.panel));
    });

    // list add / remove
    document.querySelector('.set-panel').addEventListener('click', (e) => {
      const addBtn = e.target.closest('.js-add');
      if (addBtn) {
        const key = addBtn.dataset.key;
        const inp = document.getElementById('in-' + key);
        const val = inp.value.trim();
        if (!val) return;
        inp.value = '';
        updateList(key, list => list.indexOf(val) === -1 ? list.concat(val) : list);
        return;
      }
      const rm = e.target.closest('.js-remove');
      if (rm) {
        const key = rm.dataset.key, val = rm.dataset.v;
        updateList(key, list => list.filter(x => x !== val));
        return;
      }
      const mv = e.target.closest('.js-move');
      if (mv) {
        const key = mv.dataset.key, i = +mv.dataset.i, dir = +mv.dataset.d;
        updateList(key, list => {
          const j = i + dir;
          if (j < 0 || j >= list.length) return list;
          const next = list.slice();
          const t = next[i]; next[i] = next[j]; next[j] = t;
          return next;
        });
        return;
      }
    });
    document.querySelectorAll('.add-row input').forEach(inp => inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const add = inp.closest('.add-row').querySelector('.js-add');
        if (add) add.click();
      }
    }));

    // general save
    document.querySelector('.js-savegen').addEventListener('click', async () => {
      const c = App.config;
      const next = Object.assign({}, c, {
        dealerName: document.getElementById('g-dealer').value.trim() || c.dealerName,
        salesperson: document.getElementById('g-salesperson').value.trim(),
        workingDays: U.int(document.getElementById('g-wd').value, U.int(c.workingDays)),
        closingRatio: U.int(document.getElementById('g-cr').value, U.int(c.closingRatio)),
        defaultSalesTarget: U.int(document.getElementById('g-dst').value, U.int(c.defaultSalesTarget))
      });
      try { await db.settings.update(next); App.toast('General settings saved.', 'success'); bootState(); }
      catch (e) { App.toast('Unable to save general settings.', 'error'); }
    });

    // holidays add
    document.querySelector('.js-addhol').addEventListener('click', async () => {
      const name = document.getElementById('h-name').value.trim();
      const date = document.getElementById('h-date').value;
      if (!name || !date) { App.toast('Please enter a holiday name and date.', 'error'); return; }
      try { await db.holidays.add(name, date); document.getElementById('h-name').value = ''; document.getElementById('h-date').value = ''; App.toast('Holiday added.', 'success'); renderHolidays(); }
      catch (e) { App.toast(e.message || 'Unable to add holiday.', 'error'); }
    });

    // back up
    document.querySelector('.js-expbackup').addEventListener('click', () => saveBackup());
    document.getElementById('imp-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importBackupFile(e.target.files[0]);
      e.target.value = '';
    });

    // demo
    document.querySelector('.js-loaddemo').addEventListener('click', async () => {
      const ok = await App.confirm({ title: 'Load sample data?', message: 'Adds demo leads and activities so you can explore the CRM. Run it only when your lead list is empty to avoid mixing demo records with real ones.', confirmLabel: 'Load Sample' });
      if (!ok) return;
      const curLeads = await db.leads.getAll();
      if (curLeads.length) { App.toast('Your accounts already have data. Use Clear ALL Data first to explore the demo.', 'info'); return; }
      try {
        await db.settings.update({ seeded: false });
        await App.seedDemoData();
        App.toast('Sample data loaded.', 'success');
        bootState();
      } catch (e) { App.toast('Unable to load sample data.', 'error'); console.error(e); }
    });

    // clear
    document.querySelector('.js-cleardata').addEventListener('click', async () => {
      const ok = await App.confirm({ title: 'Permanently delete ALL data?', message: 'Every lead, activity, target and holiday in this browser will be deleted. Export a backup first if you need it.', danger: true, confirmLabel: 'Delete Everything' });
      if (!ok) return;
      try {
        await db.clearAll();
        const cfg = db.getConfig(); cfg.seeded = true;
        await db.settings.update({ seeded: true, demoData: false });
        App.toast('All data cleared.', 'success');
        bootState();
      } catch (e) { App.toast('Unable to clear data.', 'error'); }
    });
  }

  window.addEventListener('app:boot', boot);
})();