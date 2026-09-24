/* ============================================================
   Toyota CRM — kanban.js
   Pipeline board. Drag & drop with a stage-select fallback.
   LEADS DATA IS THE SOURCE OF TRUTH — columns are derived from
   the leads' pipeline stage each render.
   ============================================================ */
(function () {
  'use strict';
  const U = window.Utils, db = window.db, App = window.App;
  const ic = (n, c) => App.icon(n, c, 15);

  const state = { assign: '', veh: '' };
  let dragId = null;
  let clickSuppress = false;

  function render() {
    const cfg = App.config;
    const assignSel = document.getElementById('kb-assign');
    const vehSel = document.getElementById('kb-veh');
    const all = App._cache.kanbanCache || [];

    const assignees = Array.from(new Set(all.map(l => l.assignedTo).filter(Boolean))).sort();
    const vehicles = Array.from(new Set(all.map(l => l.vehicleInterest).filter(Boolean))).sort();
    const fillOpts = (sel, opts) => {
      const cur = sel.value;
      sel.innerHTML = '<option value="">' + sel.getAttribute('aria-label') + '</option>' + opts.map(o => '<option' + (o === cur ? ' selected' : '') + '>' + U.esc(o) + '</option>').join('');
    };
    fillOpts(assignSel, assignees);
    fillOpts(vehSel, vehicles);

    const leads = all.filter(l => !l.archived);
    const filtered = leads.filter(l => {
      if (state.assign && l.assignedTo !== state.assign) return false;
      if (state.veh && l.vehicleInterest !== state.veh) return false;
      return true;
    });

    const board = document.getElementById('kanban');
    board.innerHTML = cfg.stages.map((st, si) => {
      const cards = filtered.filter(l => l.stage === st);
      return '<div class="kanban-col" data-stage="' + U.esc(st) + '" data-idx="' + si + '">' +
        '<div class="khead"><span class="kdot"></span><span class="ktitle">' + U.esc(st) + '</span><span class="kcount">' + cards.length + '</span></div>' +
        '<div class="kbody">' +
        cards.map(cardHTML).join('') +
        '</div></div>';
    }).join('');

    bindBoard();
  }

  function cardHTML(l) {
    const b = LeadView.fuBucket(l.nextFollowupDate);
    const cfg = App.config;
    return '<div class="kcard pri-' + U.esc(l.priority || 'Cold') + '" draggable="true" data-id="' + U.esc(l.id) + '">' +
      '<div class="kc-id">' + U.esc(l.id) + (l.priority === 'Hot' ? ' 🔥' : '') + '</div>' +
      '<div class="kc-name">' + U.esc(LeadView.customerName(l)) + '</div>' +
      '<div class="kc-veh">' + ic('car', '', 12) + ' ' + U.esc(LeadView.vehicleLabel(l)) + '</div>' +
      '<div class="kc-foot">' +
      (l.nextFollowupDate ? '<span class="kc-fu"><span class="fu-chip ' + b.cls + '" style="font-size:10px">' + U.esc(b.label) + '</span></span>' : '') +
      (l.assignedTo ? '<span class="badge outline badge-sm">' + U.esc(l.assignedTo) + '</span>' : '') +
      '</div>' +
      '<div class="kc-next">' + U.esc(l.nextStep || '') + '</div>' +
      '<select class="kc-stage" aria-label="Move ' + U.esc(l.id) + ' to stage" data-id="' + U.esc(l.id) + '">' +
      cfg.stages.map(s => '<option' + (l.stage === s ? ' selected' : '') + '>' + U.esc(s) + '</option>').join('') +
      '</select>' +
      '</div>';
  }

  function bindBoard() {
    const board = document.getElementById('kanban');

    board.querySelectorAll('.kcard').forEach(card => {
      card.addEventListener('click', (e) => {
        if (clickSuppress) { clickSuppress = false; return; }
        if (e.target.closest('.kc-stage')) return;
        App.openLead(card.dataset.id);
      });
      card.addEventListener('dragstart', (e) => {
        dragId = card.dataset.id;
        clickSuppress = true;
        setTimeout(() => { clickSuppress = false; }, 400);
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', dragId);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        board.querySelectorAll('.kbody').forEach(b => b.classList.remove('drop-hover'));
      });
      const sel = card.querySelector('.kc-stage');
      sel.addEventListener('change', async () => {
        try {
          await db.leads.update(card.dataset.id, { stage: sel.value });
          App.toast('Lead moved to ' + sel.value + '.', 'success');
        } catch (err) { App.toast('Unable to update stage.', 'error'); }
      });
    });

    board.querySelectorAll('.kbody').forEach(body => {
      const stage = body.parentElement.dataset.stage;
      body.addEventListener('dragover', (e) => {
        e.preventDefault();
        body.classList.add('drop-hover');
        e.dataTransfer.dropEffect = 'move';
      });
      body.addEventListener('dragleave', () => body.classList.remove('drop-hover'));
      body.addEventListener('drop', async (e) => {
        e.preventDefault();
        body.classList.remove('drop-hover');
        if (!dragId) return;
        const lead = await db.leads.get(dragId);
        if (!lead) return;
        try {
          await db.leads.update(dragId, { stage });
          App.toast('Lead ' + dragId + ' moved to ' + stage + '.', 'success');
        } catch (err) { App.toast('Unable to update stage from drag.', 'error'); }
        dragId = null;
      });
    });
  }

  async function refreshData() {
    const all = await App.data('leads');
    App._cache.kanbanCache = all;
    render();
  }

  function boot() {
    document.getElementById('kb-refresh').addEventListener('click', () => refreshData());
    ['kb-assign', 'kb-veh'].forEach(id => document.getElementById(id).addEventListener('change', (e) => {
      state[id === 'kb-assign' ? 'assign' : 'veh'] = e.target.value;
      render();
    }));
    refreshData();
  }

  window.addEventListener('app:boot', boot);
  document.addEventListener('crm:changed', (e) => { if (e.detail && e.detail.table === 'leads') refreshData(); });
})();