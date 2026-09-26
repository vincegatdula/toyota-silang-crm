/* ============================================================
   Toyota CRM — leadview.js
   Lead Detail, Add/Edit forms, Quick Add, Activities modal.
   Shared across all pages (global LeadView).
   ============================================================ */
(function (global) {
  'use strict';
  const U = global.Utils;
  const db = global.db;
  const App = global.App;
  const icon = (n, c, s) => App.icon(n, c, s);

  /* ---------- shared badge helpers ---------- */
  function statusSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function statusBadge(s) { return '<span class="badge badge-' + statusSlug(s) + '">' + U.esc(s || '—') + '</span>'; }
  function stageBadge(s) { return '<span class="badge outline">' + U.esc(s || '—') + '</span>'; }
  function priBadge(p) { return '<span class="pri pri-' + U.esc(p || 'Cold') + '">' + U.esc(p || 'Cold') + '</span>'; }

  function fuBucket(iso) {
    if (!iso) return { key: 'none', label: 'No follow-up', cls: 'fu-none' };
    const today = U.todayISO();
    const d = U.diffDays(today, iso);
    if (d < 0) return { key: 'overdue', label: 'Overdue', cls: 'fu-overdue' };
    if (d === 0) return { key: 'today', label: 'Due today', cls: 'fu-today' };
    if (d === 1) return { key: 'tomorrow', label: 'Tomorrow', cls: 'fu-tomorrow' };
    if (d <= 7) return { key: 'week', label: 'Next 7 days', cls: 'fu-week' };
    if (d <= 30) return { key: '30', label: 'Next 30 days', cls: 'fu-30' };
    return { key: 'future', label: U.fmtDate(iso, { short: true }), cls: 'fu-none' };
  }
  function fuChip(iso) {
    const b = fuBucket(iso);
    return '<span class="fu-chip ' + b.cls + '">' + (b.key === 'overdue' || b.key === 'today' ? icon('alert', 'ic8') : '') + U.esc(b.label) + '</span>';
  }
  function customerName(l) { return l && (l.name || (l.leadType === 'corporate' ? l.companyName : '')) || '—'; }
  function vehicleLabel(l) {
    const parts = [l.vehicleInterest, l.variant, l.color].filter(x => x);
    return parts.join(' · ') || '—';
  }
  const money = (v) => (v === '' || v === undefined || v === null ? '—' : U.fmtMoney(v));
  const OR_ = '—';

  /* =========================================================
     ACTIVITY MODAL
     ========================================================= */
  function openActivity(opts) {
    opts = opts || {};
    const leadId = opts.leadId || '';
    const act = opts.activity || null;
    const cfg = db.getConfig();
    let leadName = '';
    let leadOpts = '<option value="">— No lead —</option>';
    db.leads.getAll().then(all => {
      if (leadId) leadOpts = '<option value="">— No lead —</option>';
      all.filter(l => !l.archived).sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(l => {
        leadOpts += '<option value="' + U.esc(l.id) + '"' + (l.id === leadId ? ' selected' : '') + '>' + U.esc(l.id + ' — ' + (l.name || l.companyName || '')) + '</option>';
      });
      if (act && act.leadId) leadName = '';
      const html =
        '<form id="act-form" class="form-grid">' +
        '<div class="field" style="grid-column:1/-1"><label>Lead</label><select name="leadId">' + leadOpts + '</select></div>' +
        '<div class="field"><label>Type <span class="req">*</span></label><select name="type" required>' +
        cfg.activityTypes.map(t => '<option' + (act && act.type === t ? ' selected' : '') + '>' + U.esc(t) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Activity Date</label><input type="date" name="activityDate" value="' + U.esc((act && act.activityDate) || U.todayISO()) + '"></div>' +
        '<div class="field"><label>Time</label><input type="time" name="time" value="' + U.esc((act && act.time) || '') + '"></div>' +
        '<div class="field"><label>Due Date</label><input type="date" name="dueDate" value="' + U.esc((act && act.dueDate) || U.todayISO()) + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" rows="2" placeholder="What was done / to do…">' + U.esc((act && act.notes) || '') + '</textarea></div>' +
        '<div class="field"><label>Outcome</label><input type="text" name="outcome" value="' + U.esc((act && act.outcome) || '') + '"></div>' +
        '<div class="field"><label>Next Step</label><input type="text" name="nextStep" value="' + U.esc((act && act.nextStep) || '') + '"></div>' +
        '<div class="field"><label>Next Follow-up Date</label><input type="date" name="nextFollowup" value="' + U.esc((act && act.nextFollowup) || '') + '"></div>' +
        '<div class="field"><label>Completed</label><select name="completed"><option value="0">No</option><option value="1"' + (act && act.completed ? ' selected' : '') + '>Yes</option></select></div>' +
        '</form>';
      App.modal({
        title: act ? 'Edit Activity ' + U.esc(act.id) : 'Add Activity',
        size: 'md',
        content: html,
        footer:
          (act ? '<button type="button" class="btn danger js-delact">' + icon('trash', 'ic') + ' Delete</button>' : '') +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn ghost js-cancel">Cancel</button>' +
          '<button type="submit" form="act-form" class="btn primary">' + (act ? 'Save' : 'Add') + '</button>'
      });
      const form = document.getElementById('act-form');
      const save = async () => {
        if (!form.reportValidity()) return;
        const raw = collect(form);
        const payload = Object.assign({}, raw, { completed: raw.completed ? true : false });
        try {
          if (act) await db.activities.update(act.id, payload);
          else {
            payload.leadName = '';
            const created = await db.activities.create(payload);
            if (created.leadId) {
              const lead = await db.leads.get(created.leadId);
              if (lead) await db.activities.update(created.id, { leadName: customerName(lead) });
            }
          }
          // keep lead follow-up in sync when it's a follow-up-type activity
          if (payload.leadId && payload.nextFollowup && (payload.type === 'Follow-up' || payload.type === 'Call' || payload.type === 'Meeting')) {
            const lead = await db.leads.get(payload.leadId);
            if (lead && !lead.released) {
              await db.leads.update(payload.leadId, { nextFollowupDate: payload.nextFollowup, lastContactDate: payload.activityDate || U.todayISO(), nextStep: payload.nextStep || lead.nextStep });
            }
          }
          App.closeModal();
          App.toast(act ? 'Activity updated.' : 'Activity added.', 'success');
          if (typeof opts.onDone === 'function') opts.onDone();
        } catch (err) {
          App.toast('Unable to save activity.', 'error');
          console.error(err);
        }
      };
      form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
      document.querySelector('.modal .js-cancel').addEventListener('click', () => App.closeModal());
      const delBtn = document.querySelector('.modal .js-delact');
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!App.confirm) {} // no-op
        const ok = await App.confirm({ title: 'Delete activity ' + act.id + '?', message: 'This cannot be undone.', danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        try { await db.activities.remove(act.id); App.closeModal(); App.toast('Activity deleted.', 'success'); if (typeof opts.onDone === 'function') opts.onDone(); }
        catch (e) { App.toast('Unable to delete activity.', 'error'); }
      });
    });
  }

  function splitName(full) {
    if (!full) return { f: '', m: '', l: '', s: '' };
    const parts = String(full).trim().split(/\s+/);
    const suffixes = /\b(jr\.?|sr\.?|i{1,3}v?\.?|ii+\.?)\b/i;
    const s = parts.some(p => suffixes.test(p)) ? parts.pop() : '';
    const f = parts.shift() || '';
    const l = parts.pop() || '';
    const m = parts.join(' ');
    return { f, m, l, s };
  }

  function collect(form) {
    const out = {};
    const names = {};
    form.querySelectorAll('[name]').forEach(el => { (names[el.name] = names[el.name] || []).push(el); });
    Object.keys(names).forEach(n => {
      const els = names[n];
      const first = els[0];
      if (first.type === 'radio') { const c = els.find(e => e.checked); out[n] = c ? c.value : ''; }
      else if (first.type === 'checkbox') out[n] = !!first.checked;
      else if (first.type === 'number') { out[n] = first.value === '' ? '' : Number(first.value); }
      else out[n] = first.value.trim();
    });
    return out;
  }

  /* =========================================================
     LEAD FORM (full add/edit)
     ========================================================= */
  function sel(name, label, options, value, req) {
    let opts = options.map(o => {
      if (o && typeof o === 'object') return '<option value="' + U.esc(o.v) + '"' + (String(value) === String(o.v) ? ' selected' : '') + '>' + U.esc(o.l) + '</option>';
      return '<option' + (String(value) === String(o) ? ' selected' : '') + '>' + U.esc(o) + '</option>';
    }).join('');
    if (value && !options.some(o => String((typeof o === 'object' ? o.v : o)) === String(value))) {
      opts += '<option value="' + U.esc(value) + '" selected>' + U.esc(value) + '</option>';
    }
    return '<div class="field"><label>' + U.esc(label) + (req ? ' <span class="req">*</span>' : '') + '</label><select name="' + name + '">' + opts + '</select></div>';
  }
  function tx(name, label, value, type, req, ph, span) {
    type = type || 'text';
    return '<div class="field"' + (span ? ' style="grid-column:1/-1"' : '') + '><label>' + U.esc(label) + (req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<input type="' + type + '" name="' + name + '" value="' + U.esc(value === undefined || value === null ? '' : value) + '"' + (req ? ' required' : '') + (ph ? ' placeholder="' + U.esc(ph) + '"' : '') + '></div>';
  }
  function txarea(name, label, value, rows) {
    return '<div class="field" style="grid-column:1/-1"><label>' + U.esc(label) + '</label><textarea name="' + name + '" rows="' + (rows || 2) + '">' + U.esc(value || '') + '</textarea></div>';
  }
  function radio(name, label, options, value, span) {
    return '<div class="field"' + (span ? ' style="grid-column:1/-1"' : '') + '><label>' + U.esc(label) + '</label><div class="radio-row">' +
      options.map(o => '<label><input type="radio" name="' + name + '" value="' + U.esc(o.v || o) + '"' + (String(value) === String(o.v || o) ? ' checked' : '') + '> ' + U.esc(o.l || o) + '</label>').join('') +
      '</div></div>';
  }
  function cbox(name, label, value) {
    return '<div class="check-row"><input type="checkbox" name="' + name + '" id="f-' + name + '"' + (value ? ' checked' : '') + '><label for="f-' + name + '" style="font-size:13px">' + U.esc(label) + '</label></div>';
  }
  const H = (t) => '<div class="form-section"><h4>' + icon(t.ic || 'user', '', 14) + ' ' + U.esc(t.t) + '</h4><div class="form-grid">' + t.f() + '</div></div>';

  function buildLeadForm(lead) {
    const cfg = db.getConfig();
    const isCorp = lead && lead.leadType === 'corporate';
    const sp = (lead && lead.spouse) || {};
    const d = (k) => (lead ? (lead[k] === undefined || lead[k] === null ? '' : lead[k]) : '');
    const fin = (k) => (lead ? (lead[k] === undefined || lead[k] === null ? '' : lead[k]) : '');
    const radioStr = (v) => String(v === true ? 'yes' : v === false ? 'no' : v || 'no');
    const spParts = splitName(sp.name);
    const hasSpouseData = sp && Object.keys(sp).some(k => !U.empty(sp[k]));
    const spouseOn = d('hasSpouse') || hasSpouseData;

    let html =
      H({ t: 'Basic & Contact', ic: 'user', f: () =>
        sel('leadType', 'Customer Type', [{ v: 'individual', l: 'Individual' }, { v: 'corporate', l: 'Corporate' }], d('leadType')) +
        tx('name', 'Customer / Company Name', d('name'), 'text', true, '', true) +
        tx('mobile', 'Mobile Number', d('mobile'), 'tel') +
        tx('email', 'Email', d('email'), 'email') +
        tx('facebook', 'Facebook / Messenger', d('facebook')) +
        sel('source', 'Lead Source', cfg.leadSources, d('source')) +
        tx('assignedTo', 'Assigned To', d('assignedTo')) +
        tx('dateCreated', 'Date Created', d('dateCreated'), 'date') +
        sel('status', 'Lead Status', cfg.statuses, d('status')) +
        sel('stage', 'Pipeline Stage', cfg.stages, d('stage')) +
        sel('priority', 'Priority', cfg.priorities, d('priority'))
      });

    html += H({ t: 'Customer — Individual', ic: 'user', f: () =>
        tx('tin', 'TIN', d('tin')) +
        tx('address', 'Address', d('address'), 'text', false, '', true) +
        sel('ownershipStatus', 'Ownership Status', ['Owned', 'Leased', 'Rented', 'Living with Relatives', 'Other'], d('ownershipStatus')) +
        tx('telephone', 'Telephone', d('telephone')) +
        tx('dependents', 'Dependents', d('dependents'), 'number') +
        tx('yearsAtAddress', 'Years at Address', d('yearsAtAddress'), 'number') +
        tx('birthdate', 'Birthdate (birthday alerts)', d('birthdate'), 'date') +
        sel('buyerType', 'Buyer Type', ['First Time Buyer', 'Additional Purchase', 'Replacement'], d('buyerType')) +
        sel('purpose', 'Purpose', ['Business / Work', 'Personal / Family'], d('purpose')) +
        radio('hasSpouse', 'Spouse / Co-borrower', [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }], radioStr(spouseOn), true) +
        '<div id="spouse-box"' + (spouseOn ? '' : ' class="hidden"') + ' style="grid-column:1/-1">' +
        '<div class="form-section" style="margin-bottom:0"><h4 style="border:none;margin-bottom:6px;font-size:10.5px">Spouse / Co-borrower information</h4><div class="form-grid">' +
        tx('spouse.firstName', 'First Name', spParts.f) +
        tx('spouse.middleName', 'Middle Name', spParts.m) +
        tx('spouse.lastName', 'Last Name', spParts.l) +
        tx('spouse.suffix', 'Suffix', spParts.s) +
        tx('spouse.relationship', 'Relationship to Borrower', sp.relationship) +
        tx('spouse.mobile', 'Mobile', sp.mobile, 'tel') +
        tx('spouse.email', 'Email', sp.email, 'email') +
        tx('spouse.address', 'Address', sp.address, 'text', false, '', true) +
        tx('spouse.occupation', 'Occupation', sp.occupation) +
        tx('spouse.employer', 'Employer', sp.employer) +
        tx('spouse.monthlySalary', 'Monthly Income (PHP)', sp.monthlySalary, 'number') +
        tx('spouse.tin', 'TIN', sp.tin) +
        tx('spouse.telephone', 'Telephone', sp.telephone, 'tel') +
        sel('spouse.ownership', 'Ownership', ['Owned', 'Leased', 'Rented', 'Other'], sp.ownership) +
        tx('spouse.dependents', 'Dependents', sp.dependents, 'number') +
        tx('spouse.yearsAtAddress', 'Years at Address', sp.yearsAtAddress, 'number') +
        tx('spouse.otherIncome', 'Other Income (PHP)', sp.otherIncome, 'number') +
        '<input type="hidden" name="spouse.position" value="' + U.esc(sp.position === undefined || sp.position === null ? '' : sp.position) + '">' +
        '</div></div></div>'
      });

    if (!isCorp) {
      html += H({ t: 'Employment', ic: 'user', f: () =>
        tx('employer', 'Employer', d('employer')) +
        tx('employerAddress', 'Employer Address', d('employerAddress')) +
        tx('yearsEmployed', 'Years Employed', d('yearsEmployed'), 'number') +
        tx('position', 'Position', d('position')) +
        tx('monthlySalary', 'Monthly Salary', d('monthlySalary'), 'number') +
        tx('otherIncome', 'Other Income / Additional', d('otherIncome'), 'number')
      });
    } else {
      html += H({ t: 'Corporate', ic: 'user', f: () =>
        tx('companyAddress', 'Company Address', d('companyAddress'), 'text', false, '', true) +
        tx('companyTin', 'Company TIN', d('companyTin')) +
        tx('representative', 'Representative', d('representative')) +
        tx('representativePosition', 'Representative Position', d('representativePosition')) +
        tx('representativeMobile', 'Representative Mobile', d('representativeMobile')) +
        tx('representativeEmail', 'Representative Email', d('representativeEmail')) +
        tx('companyTelephone', 'Company Telephone', d('companyTelephone')) +
        tx('industry', 'Industry', d('industry')) +
        tx('yearsInBusiness', 'Years in Business', d('yearsInBusiness'), 'number') +
        tx('fleetSize', 'Fleet Size', d('fleetSize'), 'number') +
        sel('purpose', 'Purpose', ['Business / Work', 'Personal / Family'], d('purpose'))
      });
    }

    html += H({ t: 'Vehicle & Deal', ic: 'car', f: () =>
      sel('vehicleInterest', 'Vehicle Interest', cfg.vehicleModels, d('vehicleInterest')) +
      sel('variant', 'Variant', cfg.vehicleVariants, d('variant')) +
      sel('color', 'Color', cfg.vehicleColors, d('color')) +
      radio('financingCash', 'Financing / Cash', [{ v: 'Financing', l: 'Financing' }, { v: 'Cash', l: 'Cash' }], d('financingCash')) +
      tx('budget', 'Budget (PHP)', fin('budget'), 'number') +
      tx('downPayment', 'Down Payment (PHP)', fin('downPayment'), 'number') +
      tx('estimatedMonthly', 'Est. Monthly (PHP)', fin('estimatedMonthly'), 'number') +
      tx('estimatedPurchaseDate', 'Est. Purchase Date', fin('estimatedPurchaseDate'), 'date')
    });

    html += H({ t: 'Test Drive / Reservation', ic: 'calendar', f: () =>
      tx('testDriveDate', 'Test Drive Date', d('testDriveDate'), 'date') +
      tx('testDriveTime', 'Test Drive Time', d('testDriveTime'), 'time') +
      tx('testDriveNotes', 'Test Drive Notes', d('testDriveNotes')) +
      '<div class="field" style="justify-content:end">' + cbox('testDriveDone', 'Test drive completed', d('testDriveDone')) + '</div>' +
      sel('reservationStatus', 'Reservation', [{ v: '', l: 'None' }, { v: 'Reserved', l: 'Reserved' }, { v: 'Cancelled', l: 'Cancelled' }], d('reservationStatus')) +
      tx('reservationDate', 'Reservation Date', d('reservationDate'), 'date') +
      tx('reservationAmount', 'Reservation Amount (PHP)', d('reservationAmount'), 'number')
    });

    html += H({ t: 'Payment / Release / After-Sales', ic: 'check', f: () =>
      sel('paymentStatus', 'Payment Status', [{ v: '', l: 'Unpaid' }, { v: 'Down Payment', l: 'Down Payment' }, { v: 'Full Payment', l: 'Full Payment' }], d('paymentStatus')) +
      tx('paymentDate', 'Payment Date', d('paymentDate'), 'date') +
      tx('paymentDetails', 'Payment Details', d('paymentDetails')) +
      tx('releaseDate', 'Release Date', d('releaseDate'), 'date') +
      sel('orcrStatus', 'OR/CR Status', [{ v: '', l: 'None' }, { v: 'Pending', l: 'Pending' }, { v: 'Released', l: 'Released' }], d('orcrStatus')) +
      tx('orcrDate', 'OR/CR Date', d('orcrDate'), 'date') +
      tx('plateNumber', 'Plate Number', d('plateNumber')) +
      tx('plateDate', 'Plate Date', d('plateDate'), 'date') +
      tx('afterSalesNotes', 'After-Sales Notes', d('afterSalesNotes'), 'text', false, '', true)
    });

    html += H({ t: 'Follow-up & Notes', ic: 'activities', f: () =>
      tx('lastContactDate', 'Last Contact Date', d('lastContactDate'), 'date') +
      tx('nextFollowupDate', 'Next Follow-up Date', d('nextFollowupDate'), 'date') +
      tx('nextStep', 'Next Step', d('nextStep')) +
      txarea('notes', 'Notes', d('notes'), 3)
    });

    return html;
  }

  /* =========================================================
     QUICK ADD FORM (full lead form — spouse/co-borrower included)
     ========================================================= */
  /* Shared wiring for the lead-type toggle used by both Add and Edit:
     sections order is 0) basic, 1) customer-individual, 2) employment/corporate.
     The customer-individual section is only relevant for individuals; the
     employment/corporate section always shows (Employment for individuals,
     Corporate for companies). */
  function wireTypeToggle(form) {
    const lt = form.querySelector('[name="leadType"]');
    if (!lt) return;
    const updateType = () => {
      const corp = lt.value === 'corporate';
      const sections = form.querySelectorAll('.form-section');
      sections.forEach((s, i) => {
        if (i === 1) s.style.display = corp ? 'none' : '';
        else s.style.display = '';
      });
      const spBox = form.querySelector('#spouse-box');
      if (corp && spBox) spBox.classList.add('hidden');
    };
    lt.addEventListener('change', updateType);
    updateType();
  }

  function wireSpouseToggle(form) {
    const spRadios = form.querySelectorAll('[name="hasSpouse"]');
    spRadios.forEach(r => r.addEventListener('change', () => {
      const v = form.querySelector('[name="hasSpouse"]:checked');
      const box = form.querySelector('#spouse-box');
      if (box) box.classList.toggle('hidden', !(v && v.value === 'yes'));
    }));
  }

  /* =========================================================
     LEAD DETAIL
     ========================================================= */
  let detailLeadId = null;
  const detailSel = {};
  const detailMount = () => { closeDetail(); };

  function closeDetail() {
    const ov = document.getElementById('modal-root').querySelector('[data-detail="1"]');
    if (ov && ov.parentElement) ov.parentElement.remove();
    App.closeModal();
  }

  function open(id) {
    db.leads.get(id).then(lead => {
      if (!lead) { App.toast('Lead not found.', 'error'); return; }
      detailLeadId = id;
      renderDetail();
    }).catch(() => App.toast('Unable to open lead.', 'error'));
  }

  function openAdd() {
    const cfg = db.getConfig();
    const html = buildLeadForm({ leadType: 'individual' });
    App.modal({
      title: '+ Add Lead', size: 'lg',
      content: '<form id="quickadd-form" class="form-grid">' +
        '<div class="demo-hint small muted" style="grid-column:1/-1;margin-bottom:2px">Creates a new lead. ID and Date Created are generated automatically.</div>' +
        html + '</form>',
      footer: '<span class="spacer"></span><button type="button" class="btn ghost js-cancel">Cancel</button><button type="submit" form="quickadd-form" class="btn primary">Save Lead</button>'
    });
    const form = document.getElementById('quickadd-form');
    wireTypeToggle(form);
    wireSpouseToggle(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const raw = collect(form);
      try {
        const lead = await db.leads.create(buildLeadPayload(raw, null));
        App.closeModal();
        App.toast('Lead ' + lead.id + ' saved successfully.', 'success');
        setTimeout(() => global.LeadView.open(lead.id), 200);
      } catch (err) {
        App.toast('Unable to save lead.', 'error');
        console.error(err);
      }
    });
    document.querySelector('.modal .js-cancel').addEventListener('click', () => App.closeModal());
    form.querySelector('[name="name"]').focus();
  }

  function openEdit(id) {
    db.leads.get(id).then(lead => {
      if (!lead) { App.toast('Lead not found.', 'error'); return; }
      const html = buildLeadForm(lead);
      App.modal({
        title: 'Edit Lead ' + lead.id, size: 'lg',
        content: '<form id="lform">' + html + '</form>',
        footer:
          '<span class="spacer"></span>' +
          '<button type="button" class="btn ghost js-cancel">Cancel</button>' +
          '<button type="submit" form="lform" class="btn primary">Save Changes</button>'
      });
      document.querySelector('.modal .js-cancel').addEventListener('click', () => App.closeModal());
      const form = document.getElementById('lform');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const raw = collect(form);
        const payload = buildLeadPayload(raw, lead);
        try {
          await db.leads.update(id, payload);
          App.closeModal();
          App.toast('Lead ' + id + ' saved successfully.', 'success');
          if (detailLeadId === id) renderDetail();
        } catch (err) {
          App.toast('Unable to save lead.', 'error');
          console.error(err);
        }
      });
      wireTypeToggle(form);
      wireSpouseToggle(form);
      setTimeout(() => form.querySelector('[name="name"]').focus(), 60);
    });
  }

  function buildLeadPayload(raw, prior) {
    const hasSpouse = raw.hasSpouse === 'yes';
    const spouse = {};
    ['tin', 'address', 'ownership', 'telephone', 'mobile', 'email', 'dependents', 'yearsAtAddress', 'employer', 'position', 'monthlySalary', 'otherIncome', 'relationship', 'occupation'].forEach(k => {
      const v = raw['spouse.' + k];
      if (v !== undefined && v !== '') spouse[k] = v;
      delete raw['spouse.' + k];
    });
    const parts = ['spouse.firstName', 'spouse.middleName', 'spouse.lastName', 'spouse.suffix']
      .map(k => raw[k]).filter(v => v !== undefined && String(v).trim() !== '').map(v => String(v).trim());
    ['spouse.firstName', 'spouse.middleName', 'spouse.lastName', 'spouse.suffix'].forEach(k => delete raw[k]);
    if (parts.length) spouse.name = parts.join(' ');
    else if (prior && prior.spouse && prior.spouse.name) spouse.name = prior.spouse.name;
    delete raw.hasSpouse;
    raw.hasSpouse = hasSpouse;
    raw.spouse = spouse;
    return raw;
  }

  function renderDetail() {
    db.leads.get(detailLeadId).then(async (lead) => {
      if (!lead) return;
      const cfg = db.getConfig();
      const acts = await db.activities.getByLead(lead.id);
      const overlay = document.getElementById('modal-root').querySelector('[data-detail="1"]');
      const mount = () => {
        App.modal({
          title: 'Lead Detail', size: 'xl',
          content: '', footer: '', onClose: () => { detailLeadId = null; }
        });
        const ov = document.getElementById('modal-root').lastElementChild;
        ov.setAttribute('data-detail', '1');
        ov.querySelector('.modal-head').style.display = 'none';
        ov.querySelector('.modal-body').style.padding = '0';
        ov.querySelector('.modal-foot') && (ov.querySelector('.modal-foot').style.display = 'none');
        return ov;
      };
      const container = mount();
      const wrap = container.querySelector('.modal-body');

      wrap.innerHTML = buildDetailHTML(lead, acts, cfg);
      bindDetail(lead, wrap);
    });
  }

  function buildDetailHTML(lead, acts, cfg) {
    const f = (k) => (lead[k] === undefined || lead[k] === null || lead[k] === '' ? '' : lead[k]);
    const field = (label, val, mono) => '<div class="ll-field"><div class="llf-label">' + U.esc(label) + '</div><div class="llf-val' + (val ? '' : ' muted-val') + (mono ? ' mono' : '') + '">' + (val === '' || val === undefined || val === null ? '—' : U.esc(val)) + '</div></div>';
    const isCorp = lead.leadType === 'corporate';
    const sp = lead.spouse || {};
    const released = db.leads.isReleased(lead);

    const header =
      '<div class="ll-head" style="padding:18px 18px 12px">' +
      '<div>' +
      '<div class="ll-name">' + U.esc(customerName(lead)) + (lead.archived ? ' <span class="badge badge-archived">Archived</span>' : '') + '</div>' +
      '<div class="ll-id">' + U.esc(lead.id) + ' · created ' + U.fmtDate(lead.dateCreated) + (lead.assignedTo ? ' · ' + U.esc(lead.assignedTo) : '') + '</div>' +
      '</div>' +
      '<div class="ll-actions">' +
      '<button type="button" class="btn sm primary js-act">' + icon('plus', 'ic', 14) + ' Add Activity</button>' +
      '<button type="button" class="btn sm js-edit">' + icon('edit', 'ic', 14) + ' Edit</button>' +
      '<select class="stage-select-card js-stage" title="Pipeline stage" aria-label="Pipeline stage">' + cfg.stages.map(s => '<option' + (lead.stage === s ? ' selected' : '') + '>' + U.esc(s) + '</option>').join('') + '</select>' +
      (lead.archived
        ? '<button type="button" class="btn sm js-rearch">' + icon('refresh', 'ic', 14) + ' Restore</button>'
        : '<button type="button" class="btn sm ghost js-arch">' + icon('archive', 'ic', 14) + ' Archive</button>') +
      '<button type="button" class="btn sm danger js-del">' + icon('trash', 'ic', 14) + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="ll-badges" style="padding:0 18px 12px">' +
      statusBadge(lead.status) + stageBadge(lead.stage) + priBadge(lead.priority) +
      '<span class="badge outline">' + U.esc(lead.source || 'No source') + '</span>' +
      (released ? '<span class="badge badge-released">Released ' + U.fmtDate(lead.releaseDate, { short: true }) + '</span>' : '') +
      '</div>';

    const summary =
      '<div class="ll-section">' +
      '<h4>' + icon('phone', '', 14) + ' Contact & Follow-up</h4>' +
      '<div class="ll-grid">' +
      field('Mobile', f('mobile'), true) + field('Email', f('email')) + field('Facebook / Messenger', f('facebook')) +
      field('Last Contact', lead.lastContactDate ? U.fmtDate(lead.lastContactDate) : '') +
      '<div class="ll-field"><div class="llf-label">Next Follow-up</div><div class="llf-val">' + (lead.nextFollowupDate ? U.fmtDate(lead.nextFollowupDate) + ' ' + fuChip(lead.nextFollowupDate) : '—') + '</div></div>' +
      field('Next Step', f('nextStep')) + field('Est. Purchase', lead.estimatedPurchaseDate ? U.fmtDate(lead.estimatedPurchaseDate) : '') +
      field('Financing / Cash', f('financingCash')) + field('Budget', U.fmtMoney(f('budget'))) + field('Down Payment', U.fmtMoney(f('downPayment'))) + field('Est. Monthly', U.fmtMoney(f('estimatedMonthly'))) +
      '</div></div>';

    const cust =
      '<div class="ll-section">' +
      '<h4>' + icon('user', '', 14) + (isCorp ? ' Corporate' : ' Individual') + ' Customer</h4>' +
      '<div class="ll-grid">' +
      (isCorp ?
        field('Company Address', f('companyAddress')) + field('Company TIN', f('companyTin')) + field('Industry', f('industry')) +
        field('Years in Business', f('yearsInBusiness')) + field('Fleet Size', f('fleetSize')) + field('Company Tel', f('companyTelephone')) +
        field('Representative', f('representative')) + field('Position', f('representativePosition')) + field('Rep Mobile', f('representativeMobile')) + field('Rep Email', f('representativeEmail')) + field('Purpose', f('purpose'))
        :
        field('TIN', f('tin'), true) + field('Address', f('address')) + field('Ownership', f('ownershipStatus')) + field('Telephone', f('telephone')) +
        field('Dependents', f('dependents')) + field('Years at Address', f('yearsAtAddress')) + field('Birthdate', lead.birthdate ? U.fmtDate(lead.birthdate) : '') +
        field('Buyer Type', f('buyerType')) + field('Purpose', f('purpose')) +
        (() => {
          const hasSpData = lead.hasSpouse || Object.keys(sp).some(k => !U.empty(sp[k]));
          return field('Has Spouse', hasSpData ? 'Yes' : 'No') +
            (hasSpData ?
              field('Spouse', sp.name || (sp.firstName + ' ' + sp.lastName).trim() || '—') + field('Relationship', sp.relationship) +
              field('Spouse Mobile', sp.mobile) + field('Spouse Email', sp.email) + field('Spouse Address', sp.address) +
              field('Spouse Occupation', sp.occupation) + field('Spouse Employer', sp.employer) + field('Spouse Position', sp.position) +
              field('Spouse Income', U.fmtMoney(sp.monthlySalary)) + field('Spouse TIN', sp.tin)
              : '');
        })()
      ) +
      '</div>' +
      (!isCorp ?
        '<div class="ll-grid" style="margin-top:10px;border-top:1px dashed var(--line-2);padding-top:10px">' +
        field('Employer', f('employer')) + field('Employer Address', f('employerAddress')) + field('Years Employed', f('yearsEmployed')) +
        field('Position', f('position')) + field('Monthly Salary', U.fmtMoney(f('monthlySalary'))) + field('Other Income', U.fmtMoney(f('otherIncome'))) +
        '</div>' : '') +
      '</div>';

    const veh =
      '<div class="ll-section">' +
      '<h4>' + icon('car', '', 14) + ' Vehicle & Deal</h4>' +
      '<div class="ll-grid">' +
      field('Vehicle Interest', f('vehicleInterest')) + field('Variant', f('variant')) + field('Color', f('color')) +
      field('Est. Purchase Date', lead.estimatedPurchaseDate ? U.fmtDate(lead.estimatedPurchaseDate) : '') +
      field('Test Drive', lead.testDriveDate ? U.fmtDate(lead.testDriveDate) + (lead.testDriveTime ? ' · ' + U.esc(lead.testDriveTime) : '') + (lead.testDriveDone ? ' · done' : '') + (lead.testDriveNotes ? ' · ' + lead.testDriveNotes : '') : '') +
      field('Reservation', lead.reservationStatus ? (lead.reservationStatus + (lead.reservationDate ? ' · ' + U.fmtDate(lead.reservationDate) : '') + (lead.reservationAmount ? ' · ' + U.fmtMoney(lead.reservationAmount) : '')) : '') +
      field('Payment', lead.paymentStatus ? (lead.paymentStatus + (lead.paymentDate ? ' · ' + U.fmtDate(lead.paymentDate) : '') + (lead.paymentDetails ? ' · ' + lead.paymentDetails : '')) : '') +
      '</div></div>';

    const rel =
      '<div class="ll-section">' +
      '<h4>' + icon('check', '', 14) + ' Release & After-Sales</h4>' +
      '<div class="ll-grid">' +
      field('Release Date', lead.releaseDate ? U.fmtDate(lead.releaseDate) : '') +
      field('OR/CR', lead.orcrStatus ? (lead.orcrStatus + (lead.orcrDate ? ' · ' + U.fmtDate(lead.orcrDate) : '')) : '') +
      field('Plate Number', f('plateNumber'), true) + field('Plate Date', lead.plateDate ? U.fmtDate(lead.plateDate) : '') +
      field('After-Sales Notes', f('afterSalesNotes')) +
      '</div>' +
      (lead.notes ? '<div class="ll-grid" style="margin-top:10px;border-top:1px dashed var(--line-2);padding-top:10px"><div class="ll-field" style="grid-column:1/-1"><div class="llf-label">Notes</div><div class="llf-val">' + U.esc(lead.notes) + '</div></div></div>' : '') +
      '</div>';

    const actsHTML =
      '<div class="ll-section">' +
      '<div class="panel-title"><h4 style="display:flex;align-items:center;gap:7px">' + icon('activities', '', 14) + ' Activities & Follow-ups</h4><button type="button" class="btn sm js-act2">' + icon('plus', 'ic', 13) + ' Add</button></div>' +
      (acts.length ?
        acts.slice(0, 25).map(a => {
          const bucket = fuBucket(a.dueDate || a.activityDate);
          return '<div class="act-item' + (a.completed ? ' done' : '') + '">' +
            '<input type="checkbox" class="act-check js-actcheck" data-id="' + U.esc(a.id) + '"' + (a.completed ? ' checked' : '') + ' aria-label="Mark complete">' +
            '<div class="act-body">' +
            '<div class="act-title">' + U.esc(a.type || 'Activity') + (a.dueDate ? ' <span class="act-type-badge ' + bucket.cls + '">' + U.esc(bucket.label) + '</span>' : '') + '</div>' +
            '<div class="act-meta"><span class="mono">' + U.esc(a.id) + '</span>' +
            '<span>Due ' + U.fmtDate(a.dueDate || a.activityDate) + '</span>' +
            (a.outcome ? '<span>Outcome: ' + U.esc(a.outcome) + '</span>' : '') +
            (a.nextFollowup ? '<span>Next follow-up ' + U.fmtDate(a.nextFollowup) + '</span>' : '') +
            '</div>' +
            (a.notes ? '<div class="act-notes">' + U.esc(a.notes) + '</div>' : '') +
            '</div>' +
            '<div class="act-kebab">' +
            '<button type="button" class="btn icon ghost sm js-editact" data-id="' + U.esc(a.id) + '" aria-label="Edit activity">' + icon('edit', 'ic', 14) + '</button>' +
            '</div></div>';
        }).join('')
        : '<div class="empty" style="padding:20px">No activities yet for this lead.</div>') +
      '</div>';

    const tabs = ['Overview', 'Customer', 'Vehicle & Deal', 'Release', 'Activities ' + acts.length];
    const tabBar = '<div class="tabs" style="padding:0 18px;margin-bottom:0" role="tablist">' +
      tabs.map((t, i) => '<button type="button" class="tab' + (i === 0 ? ' active' : '') + '" data-tab="' + i + '" role="tab">' + U.esc(t) + '</button>').join('') +
      '</div>';

    return header +
      '<div class="ll-grid" style="padding:0 18px 14px">' +
      '<div class="ll-field"><div class="llf-label">Vehicle</div><div class="llf-val strong"><span style="display:inline-flex;align-items:center;gap:6px">' + icon('car', '', 15) + ' ' + U.esc(vehicleLabel(lead)) + '</span></div></div>' +
      '<div class="ll-field"><div class="llf-label">Follow-up</div><div class="llf-val">' + (lead.nextFollowupDate ? U.fmtDate(lead.nextFollowupDate) + ' ' + fuChip(lead.nextFollowupDate) : '—') + '</div></div>' +
      '</div>' +
      tabBar +
      '<div class="ll-tabs">' +
      '<div class="tab-panel" data-panel="0">' + summary + veh + rel + '</div>' +
      '<div class="tab-panel hidden" data-panel="1">' + cust + '</div>' +
      '<div class="tab-panel hidden" data-panel="2">' + veh + '</div>' +
      '<div class="tab-panel hidden" data-panel="3">' + rel + '</div>' +
      '<div class="tab-panel hidden" data-panel="4">' + actsHTML + '</div>' +
      '</div>';
  }

  function bindDetail(lead, wrap) {
    wrap.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
      wrap.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== b.dataset.tab));
    }));
    wrap.querySelector('.js-edit').addEventListener('click', () => { openEdit(lead.id); });
    wrap.querySelector('.js-act').addEventListener('click', () => openActivity({ leadId: lead.id, onDone: () => { if (detailLeadId === lead.id) renderDetail(); } }));
    const act2 = wrap.querySelector('.js-act2');
    if (act2) act2.addEventListener('click', () => openActivity({ leadId: lead.id, onDone: () => { if (detailLeadId === lead.id) renderDetail(); } }));
    wrap.querySelectorAll('.js-actcheck').forEach(c => c.addEventListener('change', async () => {
      try { await db.activities.setCompleted(c.dataset.id, c.checked); App.toast(c.checked ? 'Activity completed.' : 'Activity reopened.', 'success'); if (detailLeadId === lead.id) renderDetail(); }
      catch (e) { App.toast('Unable to update activity.', 'error'); }
    }));
    wrap.querySelectorAll('.js-editact').forEach(b => b.addEventListener('click', async (ev) => {
      const aId = ev.currentTarget.dataset.id;
      const a = await db.activities.get(aId);
      openActivity({ leadId: lead.id, activity: a, onDone: () => { if (detailLeadId === lead.id) renderDetail(); } });
    }));
    const stageSel = wrap.querySelector('.js-stage');
    stageSel.addEventListener('change', async (e) => {
      try { await db.leads.update(lead.id, { stage: e.target.value }); App.toast('Stage updated.', 'success'); if (detailLeadId === lead.id) renderDetail(); }
      catch (err) { App.toast('Unable to update stage.', 'error'); }
    });
    const archBtn = wrap.querySelector('.js-arch');
    if (archBtn) archBtn.addEventListener('click', async () => {
      const ok = await App.confirm({ title: 'Archive ' + lead.id + '?', message: 'The lead will be removed from active views. You can restore it from Archived Leads.', confirmLabel: 'Archive' });
      if (!ok) return;
      try { await db.leads.archive(lead.id); App.closeModal(); App.toast('Lead archived.', 'success'); }
      catch (e) { App.toast('Lead could not be archived.', 'error'); }
    });
    const rearch = wrap.querySelector('.js-rearch');
    if (rearch) rearch.addEventListener('click', async () => {
      try { await db.leads.restore(lead.id); App.closeModal(); App.toast('Lead restored.', 'success'); }
      catch (e) { App.toast('Could not restore lead.', 'error'); }
    });
    const delBtn = wrap.querySelector('.js-del');
    delBtn.addEventListener('click', async () => {
      const ok = await App.confirm({ title: 'Permanently delete ' + lead.id + '?', message: 'All activities for this lead will also be deleted. This cannot be undone.', danger: true, confirmLabel: 'Delete Permanently' });
      if (!ok) return;
      try {
        const acts = await db.activities.getByLead(lead.id);
        for (const a of acts) await db.activities.remove(a.id);
        await db.leads.remove(lead.id);
        App.closeModal(); App.toast('Lead deleted permanently.', 'success');
      } catch (e) { App.toast('Unable to delete lead.', 'error'); }
    });
  }

  /* profile: keep the old renderDetail wrapper signature for compatibility */
  global.LeadView = {
    open, openAdd, openEdit, openActivity,
    statusBadge, stageBadge, priBadge, fuChip, fuBucket, customerName, vehicleLabel, statusSlug
  };
})(window);