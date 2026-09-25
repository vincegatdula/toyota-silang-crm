/* ============================================================
   Toyota CRM — storage.js
   Client-side data layer over IndexedDB.

   Architectural rule: UI code must NEVER touch IndexedDB directly.
   Everything goes through the `db` facade below (or App helpers).

        UI LAYER
           |
        APPLICATION LOGIC (App, page modules)
           |
        DATA ACCESS LAYER  (this file: db.*)
           |
        INDEXEDDB

   This facade is replaceable by a cloud API later without
   rewriting the UI, because the UI only talks to db.* / App.*
   ============================================================ */
(function (global) {
  'use strict';
  const U = global.Utils;

  /* =========================================================================
     DEFAULTS — configuration values (editable from Settings).
     ========================================================================= */
  const DEFAULTS = {
    leadSources: ['Facebook', 'Phone', 'Walk-in', 'Referral', 'TikTok', 'Messenger', 'Website', 'Existing Client', 'Other'],
    statuses: ['New', 'Contacted', 'Qualified', 'Warm', 'Hot', 'Follow-up', 'Test Drive', 'Financing', 'Reserved', 'Approved', 'Released', 'Lost', 'Cold'],
    stages: ['New Lead', 'Contacted', 'Qualified', 'Needs Analysis', 'Vehicle Presentation', 'Test Drive', 'Quotation', 'Financing Application', 'Approval', 'Reservation', 'Payment', 'Release', 'After-Sales', 'Lost'],
    priorities: ['Hot', 'Warm', 'Cold'],
    activityTypes: ['Call', 'Messenger', 'SMS', 'Email', 'Follow-up', 'Meeting', 'Test Drive', 'Quotation', 'Financing Application', 'Bank Coordination', 'Reservation', 'Payment', 'Release', 'OR/CR', 'Plate', 'After-Sales', 'Other'],
    vehicleModels: ['Wigo', 'Raize', 'Vios', 'Corolla Cross', 'Corolla Altis', 'Camry', 'Avanza', 'Veloz', 'Rush', 'Fortuner', 'Hilux', 'HiAce', 'Land Cruiser Prado', 'Land Cruiser 300', 'GR Corolla', 'GR Yaris'],
    vehicleVariants: ['E', 'G', 'GX', 'V', 'LTD', 'GR-S', '2.8 LTD', 'XLE', 'XSE'],
    vehicleColors: ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Bronze', 'Beige', 'Orange', 'Other'],
    closingRatio: 25,
    workingDays: 22,
    salesperson: '',
    dealerName: 'Toyota Silang, Cavite',
    defaultSalesTarget: 5,
    seeded: false,
    demoData: true
  };

  /* Statuses that mean the lead is a pipeline exit / not an active deal. */
  const CLOSED_LIKE = { 'Released': 1, 'Lost': 1, 'Cold': 1 };
  const RELEASED_STAGE = 'Release';

  /* =========================================================================
     MINIMAL IndexedDB PROMISE WRAPPER
     ========================================================================= */
  const DB_NAME = 'toyota-crm';
  const DB_VERSION = 2;

  const STORE_SPECS = {
    leads: { keyPath: 'id' },
    activities: { keyPath: 'id', index: { name: 'leadId', fields: 'leadId', opts: { unique: false } } },
    targets: { keyPath: 'month' },
    settings: { keyPath: 'key' },
    holidays: { keyPath: 'date' },
    vehicles: { keyPath: 'id' },
    seq: { keyPath: 'key' }
  };

  /* Create any missing object stores. This runs during every upgrade so that
     databases created by older versions of the app are automatically repaired
     (missing stores recreated) instead of breaking every read on that table. */
  function ensureStores(dbx) {
    Object.keys(STORE_SPECS).forEach(name => {
      if (dbx.objectStoreNames.contains(name)) return;
      const spec = STORE_SPECS[name];
      const s = dbx.createObjectStore(name, { keyPath: spec.keyPath });
      if (spec.index) s.createIndex(spec.index.name, spec.index.fields, spec.index.opts);
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        ensureStores(e.target.result);
      };
      req.onblocked = () => { /* another tab holds an older version; waiting */ };
      req.onsuccess = (e) => {
        const dbx = e.target.result;
        /* Self-heal any stores still missing (e.g. a DB opened at the same
           version before `ensureStores` existed). Schema migration is
           additive — existing records are never touched. */
        const missing = Object.keys(STORE_SPECS).filter(n => !dbx.objectStoreNames.contains(n));
        if (missing.length) {
          const v = dbx.version + 1;
          dbx.close();
          const req2 = indexedDB.open(DB_NAME, v);
          req2.onupgradeneeded = (e2) => ensureStores(e2.target.result);
          req2.onsuccess = () => resolve(req2.result);
          req2.onerror = () => reject(req2.error);
        } else {
          resolve(dbx);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  function reqP(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function txP(dbx, store, mode, fn) {
    return new Promise((res, rej) => {
      const t = dbx.transaction(store, mode);
      const out = fn(t.objectStore(store));
      if (out && typeof out.then !== 'function') {
        // allow sync body using requests
      }
      t.oncomplete = () => res(out && typeof out.then === 'function' ? out : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  /* =========================================================================
     DATA ACCESS  (db facade)
     ========================================================================= */
  let _dbx = null;
  let _config = Object.assign({}, DEFAULTS);
  let _settingsRecord = null;
  const _listeners = new Set();

  function emit(table) {
    document.dispatchEvent(new CustomEvent('crm:changed', { detail: { table } }));
  }

  function getAllPromise(store) {
    return new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function getAll(table) {
    const dbx = await _ready;
    return new Promise((res, rej) => {
      const t = dbx.transaction(table, 'readonly');
      const r = t.objectStore(table).getAll();
      r.onsuccess = () => { res(r.result || []); };
      r.onerror = () => rej(r.error);
    });
  }
  async function getOne(table, key, dbxArg) {
    const dbx = dbxArg || await _ready;
    return new Promise((res, rej) => {
      const t = dbx.transaction(table, 'readonly');
      const r = t.objectStore(table).get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }
  async function put(table, value) {
    const dbx = await _ready;
    return new Promise((res, rej) => {
      const t = dbx.transaction(table, 'readwrite');
      t.objectStore(table).put(value);
      t.oncomplete = () => { emit(table); res(value); };
      t.onerror = () => rej(t.error);
    });
  }
  async function del(table, key) {
    const dbx = await _ready;
    return new Promise((res, rej) => {
      const t = dbx.transaction(table, 'readwrite');
      t.objectStore(table).delete(key);
      t.oncomplete = () => { emit(table); res(true); };
      t.onerror = () => rej(t.error);
    });
  }
  async function bulkPut(table, values) {
    const dbx = await _ready;
    if (!values || !values.length) return;
    return new Promise((res, rej) => {
      const t = dbx.transaction(table, 'readwrite');
      const s = t.objectStore(table);
      values.forEach(v => s.put(v));
      t.oncomplete = () => { emit(table); res(true); };
      t.onerror = () => rej(t.error);
    });
  }

  /* ---- ID generation (never reuse) ---- */
  async function nextSeq(key, prefix, existingIds) {
    const dbx = await _ready;
    const cur = await getOne('seq', key);
    let n = (cur && cur.value) || 0;
    n = n + 1;
    if (existingIds && existingIds.length) {
      const nums = existingIds.map(id => parseInt(String(id).replace(prefix, ''), 10)).filter(nn => !isNaN(nn));
      if (nums.length) n = Math.max(n, Math.max.apply(null, nums) + 1);
    }
    await put('seq', { key, value: n });
    return U.genId(prefix, n);
  }

  /* ---- counters reset on import: bump seq past imported ids ---- */
  async function bumpSeq(prefix, ids) {
    const dbx = await _ready;
    const nums = (ids || []).map(id => parseInt(String(id).replace(prefix, ''), 10)).filter(nn => !isNaN(nn));
    if (!nums.length) return;
    const max = Math.max.apply(null, nums) + 1;
    const cur = await getOne('seq', prefix === 'C' ? 'lead' : 'activity');
    const curN = (cur && cur.value) || 0;
    if (max > curN) await put('seq', { key: prefix === 'C' ? 'lead' : 'activity', value: max });
  }

  /* =========================================================================
     CONFIG / SETTINGS
     ========================================================================= */
  function loadConfig() {
    return getOne('settings', 'app', _dbx).then((s) => {
      _settingsRecord = s || { key: 'app' };
      Object.assign(_config, DEFAULTS, (s && s.config) || {});
      if (s && s.seeded !== undefined) _config.seeded = s.seeded;
      if (s && s.demoData !== undefined) _config.demoData = s.demoData;
      return _config;
    });
  }
  async function saveConfig(partialOrFull) {
    Object.assign(_config, partialOrFull);
    _settingsRecord = _settingsRecord || { key: 'app' };
    _settingsRecord.config = Object.assign({}, _settingsRecord.config || {}, partialOrFull);
    if ('seeded' in _config) _settingsRecord.seeded = _config.seeded;
    if ('demoData' in _config) _settingsRecord.demoData = _config.demoData;
    await put('settings', _settingsRecord);
    return _config;
  }
  const getConfig = () => _config;

  /* =========================================================================
     LEAD HELPERS
     ========================================================================= */
  function normalizeLead(raw, args) {
    const t = U.todayISO();
    const lead = Object.assign({
      id: args && args.id, dateCreated: t, lastModified: t,
      leadType: 'individual', name: '',
      mobile: '', email: '', facebook: '', source: DEFAULTS.leadSources[0],
      status: 'New', stage: 'New Lead', priority: 'Cold', assignedTo: '',
      lastContactDate: '', nextFollowupDate: '', nextStep: '',
      estimatedPurchaseDate: '', vehicleInterest: '', variant: '', color: '',
      budget: '', downPayment: '', estimatedMonthly: '', financingCash: '',
      testDriveDate: '', testDriveNotes: '', testDriveDone: false,
      reservationStatus: '', reservationDate: '', reservationAmount: '',
      paymentStatus: '', paymentDate: '', paymentDetails: '',
      releaseDate: '', orcrStatus: '', orcrDate: '', plateNumber: '', plateDate: '', afterSalesNotes: '',
      notes: '',
      archived: false, archivedDate: ''
    }, raw || {});
    if (!lead.id && args && args.id) lead.id = args.id;
    if (args && args.isNew) { lead.dateCreated = t; }
    lead.lastModified = t;
    return lead;
  }

  function isClosedLike(lead) {
    if (!lead) return false;
    if (lead.archived) return true;
    if (lead.status === 'Released' || lead.status === 'Lost' || lead.status === 'Cold') return true;
    if (lead.stage === 'Lost') return true;
    return false;
  }
  function isReleased(lead) {
    return !!lead && (lead.status === 'Released' || lead.stage === 'Release' || !!lead.releaseDate);
  }
  function isActive(lead) {
    return !!lead && !lead.archived && !isReleased(lead) && lead.status !== 'Lost' && lead.status !== 'Cold' && lead.stage !== 'Lost';
  }

  /* =========================================================================
     BACKUP / IMPORT
     ========================================================================= */
  async function exportBackup() {
    const [leads, activities, targets, settings, holidays, vehicles, seq] = await Promise.all([
      getAll('leads'), getAll('activities'), getAll('targets'), getAll('settings'), getAll('holidays'), getAll('vehicles'), getAll('seq')
    ]);
    const app = settings.find(s => s.key === 'app') || { key: 'app', config: _config };
    return {
      app: 'Toyota CRM',
      version: 1,
      exportedAt: new Date().toISOString(),
      dealer: (app.config && app.config.dealerName) || DEFAULTS.dealerName,
      data: { leads, activities, targets, settings: app, holidays, vehicles, seq }
    };
  }

  async function importValidation(obj) {
    if (!obj || typeof obj !== 'object') return 'Invalid file structure.';
    if (obj.app !== 'Toyota CRM' && !obj.data) return 'Not a Toyota CRM backup file.';
    const d = obj.data || obj;
    const req = ['leads', 'activities'];
    for (const k of req) if (!Array.isArray(d[k])) return 'Backup file is missing "' + k + '".';
    if (d.settings && typeof d.settings !== 'object') return 'Backup file is missing valid settings.';
    const ids = new Set();
    for (const l of d.leads) {
      if (!l || typeof l.id !== 'string') return 'A lead is missing its ID.';
      if (ids.has(l.id)) return 'Duplicate lead ID: ' + l.id;
      ids.add(l.id);
    }
    return null;
  }

  async function importBackup(obj, { replace = false } = {}) {
    const vErr = await importValidation(obj);
    if (vErr) throw new Error(vErr);
    const d = obj.data || obj;
    const dbx = await _ready;
    await new Promise((res, rej) => {
      const t = dbx.transaction(['leads', 'activities', 'targets', 'settings', 'holidays', 'vehicles', 'seq'], 'readwrite');
      const wipe = (name, objects) => {
        const s = t.objectStore(name);
        if (replace) { const c = s.count(); }
      };
      if (replace) {
        ['leads', 'activities', 'targets', 'holidays', 'vehicles', 'seq'].forEach(n => {
          const s = t.objectStore(n);
          // clear store synchronously via cursor
          const delAll = (storeName) => {
            const s2 = t.objectStore(storeName);
            const cursorReq = s2.openCursor();
            let pending = false;
            cursorReq.onsuccess = () => {
              const c = cursorReq.result;
              if (c) { s2.delete(c.primaryKey); c.continue(); pending = true; }
            };
            return pending;
          };
          delAll(n);
        });
        const s = t.objectStore('settings');
        const cur = s.openCursor();
        cur.onsuccess = () => { const c = cur.result; if (c) { c.delete(); c.continue(); } };
      }
      const putVals = (name, vals) => { const s = t.objectStore(name); (vals || []).forEach(v => s.put(v)); };
      putVals('leads', d.leads);
      putVals('activities', d.activities);
      putVals('targets', d.targets || []);
      putVals('holidays', d.holidays || []);
      putVals('vehicles', d.vehicles || []);
      putVals('seq', d.seq || []);
      const s = t.objectStore('settings');
      const app = d.settings || { key: 'app', config: DEFAULTS };
      if (app.key !== 'app') app.key = 'app';
      s.put(app);
      t.oncomplete = () => res(true);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Import failed.'));
    });
    await Promise.all([
      bumpSeq('C', d.leads.map(l => l.id)),
      bumpSeq('A', (d.activities || []).map(a => a.id))
    ]);
    await loadConfig();
    ['leads', 'activities', 'targets', 'holidays', 'vehicles', 'settings'].forEach(emit);
    return true;
  }

  /* ---- clear all (danger) ---- */
  async function clearAll() {
    const dbx = await _ready;
    await new Promise((res, rej) => {
      const t = dbx.transaction(['leads', 'activities', 'targets', 'holidays', 'vehicles', 'seq', 'settings'], 'readwrite');
      ['leads', 'activities', 'targets', 'holidays', 'vehicles', 'seq', 'settings'].forEach(n => t.objectStore(n).clear());
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    _settingsRecord = null;
    Object.assign(_config, DEFAULTS);
    await loadConfig();
    ['leads', 'activities', 'targets', 'holidays', 'vehicles', 'settings'].forEach(emit);
  }

  /* =========================================================================
     DB FACADE
     ========================================================================= */
  const _ready = openDB().then((dbx) => { _dbx = dbx; return loadConfig().then(() => dbx); });

  const db = {
    ready: _ready,
    defaults: DEFAULTS,
    getConfig,
    config: () => _config,

    leads: {
      async getAll() { return getAll('leads'); },
      async getActive() { const all = await getAll('leads'); return all.filter(l => !l.archived); },
      async get(id) { return getOne('leads', id); },
      async create(raw) {
        const existing = await getAll('leads');
        const id = await nextSeq('lead', 'C', existing.map(l => l.id));
        const lead = normalizeLead(raw, { id, isNew: true });
        await put('leads', lead);
        return lead;
      },
      async update(id, raw) {
        const cur = (await getOne('leads', id)) || {};
        const lead = normalizeLead(Object.assign({}, cur, raw), { id });
        await put('leads', lead);
        return lead;
      },
      async saveImport(raw, id) {
        const lead = normalizeLead(raw, { id });
        await put('leads', lead);
        return lead;
      },
      async archive(id) {
        const cur = await getOne('leads', id);
        if (!cur) throw new Error('Lead not found.');
        cur.archived = true;
        cur.archivedDate = U.todayISO();
        cur.lastModified = cur.archivedDate;
        await put('leads', cur);
        return cur;
      },
      async restore(id) {
        const cur = await getOne('leads', id);
        if (!cur) throw new Error('Lead not found.');
        cur.archived = false;
        cur.archivedDate = '';
        cur.lastModified = U.todayISO();
        await put('leads', cur);
        return cur;
      },
      async remove(id) { return del('leads', id); },
      normalize: normalizeLead,
      isClosedLike, isReleased, isActive,
      CLOSED_LIKE, RELEASED_STAGE
    },

    activities: {
      async getAll() {
        /* Defensive read: tolerate records written by older versions of the app
           (missing fields, malformed dates, non-object values) so one corrupt
           record can never blank the entire Activities view. */
        const all = (await getAll('activities'))
          .filter(a => a && typeof a === 'object')
          .map(a => {
            const clean = Object.assign({}, a);
            ['id', 'leadId', 'leadName', 'type', 'outcome', 'notes', 'nextStep'].forEach(k => {
              if (clean[k] === undefined || clean[k] === null) clean[k] = '';
            });
            return clean;
          });
        return all.sort((a, b) => {
          const d = String(b.dueDate || b.activityDate || '').localeCompare(a.dueDate || a.activityDate || '');
          return d || String(b.id || '').localeCompare(String(a.id || ''));
        });
      },
      async get(id) { return getOne('activities', id); },
      async getByLead(leadId) {
        const all = await getAll('activities');
        return all.filter(a => a.leadId === leadId).sort((a, b) => String(b.dueDate || '').localeCompare(a.dueDate || ''));
      },
      async create(raw) {
        const existing = await getAll('activities');
        const id = await nextSeq('activity', 'A', existing.map(a => a.id));
        const act = Object.assign({
          id, leadId: '', leadName: '', type: 'Call',
          activityDate: U.todayISO(), dueDate: U.todayISO(),
          completed: false, completedDate: '', outcome: '',
          notes: '', nextStep: '', nextFollowup: '', createdDate: U.todayISO()
        }, raw);
        act.id = id;
        if (!act.dueDate && act.activityDate) act.dueDate = act.activityDate;
        await put('activities', act);
        return act;
      },
      async update(id, raw) {
        const cur = (await getOne('activities', id)) || {};
        const act = Object.assign({}, cur, raw);
        await put('activities', act);
        return act;
      },
      async setCompleted(id, done) {
        const cur = await getOne('activities', id);
        if (!cur) return null;
        cur.completed = !!done;
        cur.completedDate = done ? U.todayISO() : '';
        await put('activities', cur);
        return cur;
      },
      async remove(id) { return del('activities', id); }
    },

    targets: {
      async get(month) { return (await getOne('targets', month)) || { month, salesTarget: _config.defaultSalesTarget, leadTargets: {}, workingDays: 0, closingRatio: 0, notes: '' }; },
      async set(month, data) { return put('targets', Object.assign({ month }, data)); },
      async getAll() { return getAll('targets'); },
      async remove(month) { return del('targets', month); }
    },

    settings: {
      async get() { return _settingsRecord || { key: 'app', config: Object.assign({}, DEFAULTS) }; },
      async update(partial) { return saveConfig(partial); }
    },

    holidays: {
      async getAll() { const h = await getAll('holidays'); return h.sort((a, b) => a.date.localeCompare(b.date)); },
      async add(name, date) {
        const existing = await getAll('holidays');
        if (existing.some(h => h.date === date)) throw new Error('A holiday already exists on that date.');
        await put('holidays', { date, name });
        return { date, name };
      },
      async remove(date) { return del('holidays', date); }
    },

    vehicles: {
      async getAll() { return getAll('vehicles'); },
      async create(v) { const id = (v && v.id) || 'v' + Date.now(); return put('vehicles', Object.assign({ id }, v)); },
      async remove(id) { return del('vehicles', id); }
    },

    exportBackup,
    importBackup,
    importValidation,
    clearAll,

    _raw: { getAll, getOne, put, del, bulkPut }
  };

  global.db = db;
  global.DEFAULTS = DEFAULTS;
})(window);