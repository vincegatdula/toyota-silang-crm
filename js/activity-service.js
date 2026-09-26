/* ============================================================
   Toyota CRM — activity-service.js
   Single source of truth for activity data across the app.

   Architecture:
        activityService.getAll()
              |
        Activities page  →  Dashboard activity card  →  Calendar

   The service joins every activity with the REAL, current lead record so all
   views agree. Archived leads are resolved (still shown, flagged), and
   activities whose lead was deleted display "Lead unavailable" instead of
   crashing.
   ============================================================ */
(function (global) {
  'use strict';
  const U = global.Utils;
  const db = global.db;

  function leadDisplayName(lead) {
    if (!lead) return 'Lead unavailable';
    return lead.name || (lead.leadType === 'corporate' ? (lead.companyName || 'Lead unavailable') : 'Lead unavailable');
  }

  const actDate = (a) => (a && (a.dueDate || a.activityDate)) || '';

  /* Resolve all persisted activities together with their current lead.
     Reads through App's shared cache when available so the Activities page,
     Dashboard and Calendar all observe the same data. */
  async function getAll() {
    /* Always re-read the persisted records so writes that triggered this call
       (directly or via 'crm:changed') are never masked by a stale App.data
       snapshot, regardless of event-listener ordering. */
    const app = global.App;
    if (app && typeof app.invalidate === 'function') {
      app.invalidate('activities');
      app.invalidate('leads');
    }
    const read = (app && app.data) ? (t) => app.data(t) : (t) => db[t].getAll();
    const [acts, leads] = await Promise.all([read('activities'), read('leads')]);
    const byId = {};
    (leads || []).forEach(l => { if (l && l.id) byId[l.id] = l; });
    const resolved = (acts || []).map(a => {
      const lead = (a && a.leadId) ? (byId[a.leadId] || null) : null;
      return Object.assign({}, a, {
        leadName: (a && a.leadName) || (lead ? leadDisplayName(lead) : ((a && a.leadId) ? 'Lead unavailable' : '—')),
        leadArchived: !!(lead && lead.archived),
        leadUnavailable: !!(a && a.leadId) && !lead,
        lead
      });
    });
    return withLeadTestDrives(resolved, leads || []);
  }

  /* The New Lead / Edit Lead form stores scheduled test drives on the LEAD
     record (testDriveDate / testDriveTime / testDriveNotes / testDriveDone)
     rather than as activity records. Surface those here as feed entries so the
     Dashboard card, Activities page and Calendar share ONE source of truth.
     A lead that already has a real "Test Drive" activity is not duplicated. */
  function withLeadTestDrives(resolved, leads) {
    const covered = new Set();
    resolved.forEach(a => { if (a && a.type === 'Test Drive' && a.leadId) covered.add(a.leadId); });
    const extra = [];
    leads.forEach(l => {
      if (!l || !l.id || !l.testDriveDate || covered.has(l.id)) return;
      extra.push({
        id: 'TD-' + l.id,
        leadId: l.id,
        leadName: leadDisplayName(l),
        type: 'Test Drive',
        activityDate: l.testDriveDate,
        dueDate: l.testDriveDate,
        time: l.testDriveTime || '',
        notes: l.testDriveNotes || '',
        completed: !!l.testDriveDone,
        completedDate: l.testDriveDone ? l.testDriveDate : '',
        nextStep: l.nextStep || '',
        synthetic: true,
        lead: l,
        leadArchived: !!l.archived,
        leadUnavailable: false
      });
    });
    return resolved.concat(extra);
  }

  function bucketPrio(a) {
    const iso = actDate(a);
    if (!iso) return 5;
    const d = U.diffDays(U.todayISO(), iso);
    if (d < 0) return 0;   // overdue first
    if (d === 0) return 1; // due today
    if (d <= 7) return 2;
    if (d <= 30) return 3;
    return 4;
  }

  /* Sensible feed order: pending (overdue → today → soonest due) before
     completed (most recently completed first). Used by every view so the
     Activities tab, dashboard card and calendar stay consistent. */
  function sortFeed(acts) {
    return acts.slice().sort((a, b) => {
      const ap = a.completed ? 1 : bucketPrio(a);
      const bp = b.completed ? 1 : bucketPrio(b);
      if (ap !== bp) return ap - bp;
      if (!a.completed) return String(actDate(a)).localeCompare(String(actDate(b)));
      const ca = a.completedDate || actDate(a);
      const cb = b.completedDate || actDate(b);
      return String(cb).localeCompare(String(ca));
    });
  }

  function isUpcoming(a) {
    if (a.completed) return false;
    const iso = actDate(a);
    if (!iso) return false;
    const d = U.diffDays(U.todayISO(), iso);
    return d >= 0 && d <= 30;
  }

  function isOverdue(a) {
    if (a.completed) return false;
    const iso = actDate(a);
    return !!iso && U.diffDays(U.todayISO(), iso) < 0;
  }

  global.ActivityService = { getAll, sortFeed, actDate, isUpcoming, isOverdue, leadDisplayName };
})(window);