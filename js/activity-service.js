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
    const read = (global.App && global.App.data) ? (t) => global.App.data(t) : (t) => db[t].getAll();
    const [acts, leads] = await Promise.all([read('activities'), read('leads')]);
    const byId = {};
    (leads || []).forEach(l => { if (l && l.id) byId[l.id] = l; });
    return (acts || []).map(a => {
      const lead = (a && a.leadId) ? (byId[a.leadId] || null) : null;
      return Object.assign({}, a, {
        leadName: (a && a.leadName) || (lead ? leadDisplayName(lead) : ((a && a.leadId) ? 'Lead unavailable' : '—')),
        leadArchived: !!(lead && lead.archived),
        leadUnavailable: !!(a && a.leadId) && !lead,
        lead
      });
    });
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