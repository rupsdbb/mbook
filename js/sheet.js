/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Grid rendering
   ===================================================================== */
const $ = id => document.getElementById(id);
const tbody = $('rows');
let currentId = null;
const checked = new Set();

function cellInput(field) {
  return `<input class="cell" data-f="${field}" autocomplete="off" spellcheck="false">`;
}

function renderAll() {
  const frag = document.createDocumentFragment();
  project.lines.forEach((line, idx) => frag.appendChild(buildRow(line, idx)));
  tbody.replaceChildren(frag);
  $('empty').hidden = project.lines.length > 0;
  refreshTotals();
  refreshLists();
  $('chkAll').checked = project.lines.length > 0 && checked.size === project.lines.length;
}

function buildRow(line, idx) {
  const tr = document.createElement('tr');
  tr.dataset.id = line.id;
  tr.innerHTML = `
    <td class="c-sel"><input type="checkbox" class="rowchk" tabindex="-1"></td>
    <td class="c-line ro num"></td>
    <td class="c-flag"></td>
    <td class="c-code">${cellInput('code')}</td>
    <td class="c-short ro"><div class="short"><span></span><button class="info" title="Full SOR text (Ctrl+I)" tabindex="-1">ⓘ</button></div></td>
    <td class="c-desc">${cellInput('desc')}</td>
    <td class="c-dim num">${cellInput('no')}</td>
    <td class="c-dim num">${cellInput('l')}</td>
    <td class="c-dim num">${cellInput('b')}</td>
    <td class="c-hd num">${cellInput('hd')}<span class="tag"></span></td>
    <td class="c-qty ro num"></td>
    <td class="c-unit ro"></td>
    <td class="c-price ro num"></td>
    <td class="c-amt ro num"></td>
    <td class="c-po">${cellInput('poItem')}</td>
    <td class="c-asset">${cellInput('asset')}</td>`;
  tr.querySelector('.rowchk').checked = checked.has(line.id);
  tr.classList.toggle('checked', checked.has(line.id));
  tr.classList.toggle('current', line.id === currentId);
  for (const inp of tr.querySelectorAll('input.cell')) showCell(inp, line);
  updateRow(tr, line, idx);
  return tr;
}

// Display value of an editable cell when it is not being edited.
function showCell(inp, line) {
  const f = inp.dataset.f;
  const raw = line[f] ?? '';
  const td = inp.parentElement;
  if (DIMS.includes(f)) {
    const r = evalExpr(raw);
    const isExpr = raw !== '' && !isPlainNumber(raw) && !r.error;
    td.classList.toggle('expr', isExpr);
    td.classList.toggle('bad', !!r.error);
    td.title = isExpr ? `= ${raw}` : (r.error ? `Cannot calculate: ${raw}` : '');
    // While editing, the cell shows what was typed; otherwise the value in the
    // item's decimal places (an expression shows its result)
    inp.value = document.activeElement !== inp && r.value !== null && !r.error
      ? fmtDim(r.value, compute(line).uf) : raw;
    if (f === 'hd') {
      const tag = td.querySelector('.tag');
      tag.textContent = line.hdSection || '';
      tag.title = line.hdSection ? `${line.hdSection} — kg/m from BIS` : '';
    }
  } else {
    inp.value = raw;
  }
  if (f === 'code') td.classList.toggle('bad', !!line.code && !sorMap.has(String(line.code)));
}

function updateRow(tr, line, idx) {
  const c = compute(line);
  const cells = tr.children;
  cells[1].textContent = idx + 1;
  const sp = cells[4].querySelector('span');
  sp.textContent = c.info ? c.info.short : (line.code ? 'Not in SOR' : '');
  sp.classList.toggle('missing', !!line.code && !c.info);
  cells[10].textContent = line.code || c.qty ? fmtQty(c.qty, c.uf) : '';
  cells[11].textContent = c.info ? c.info.unit : (line.ref?.unit || '');
  cells[12].textContent = c.sor ? fmtMoney(c.price) : (c.look ? '—' : '');
  cells[12].title = c.look && !c.sor ? `No SOR rate ${rateContext()}` : (c.sor?.states.length ? `${c.sor.states.join('/')} SOR` : '');
  cells[13].textContent = c.sor ? fmtMoney(c.amount) : '';
  const flags = flagsFor(line, c);
  const fc = cells[2];
  if (flags.length) {
    const lvl = flags.some(f => f.level === 'err') ? 'err' : 'warn';
    fc.innerHTML = `<button class="flag ${lvl}" tabindex="-1" title="${esc(flags.map(f => f.text).join('\n'))}">!</button>`;
  } else fc.innerHTML = '';
}

function rowEl(id) { return tbody.querySelector(`tr[data-id="${id}"]`); }
function lineById(id) { return project.lines.find(l => l.id === id); }
function indexOfId(id) { return project.lines.findIndex(l => l.id === id); }

function refreshRow(line) {
  const tr = rowEl(line.id);
  if (!tr) return;
  // Includes the focused cell: a closing popup hands focus back to it, and a
  // stale value there would be committed over the pick on blur.
  for (const inp of tr.querySelectorAll('input.cell')) showCell(inp, line);
  updateRow(tr, line, indexOfId(line.id));
}

function refreshTotals() {
  let total = 0, flagged = 0;
  const kinds = {}, expiredOn = [];
  for (const line of project.lines) {
    const c = compute(line);
    total += c.amount;
    const flags = flagsFor(line, c);
    if (!flags.length) continue;
    flagged++;
    for (const k of new Set(flags.map(f => f.kind))) kinds[k] = (kinds[k] || 0) + 1;
    if (c.look?.outOfDate && c.sor.to) expiredOn.push(c.sor.to);
  }
  $('grandTotal').textContent = fmtMoney(total);
  $('stLines').textContent = project.lines.length;
  $('stLinesLabel').textContent = project.lines.length === 1 ? 'entry' : 'entries';
  $('stFlags').textContent = flagged;
  $('stFlagsLabel').textContent = flagged === 1 ? 'entry needs review' : 'entries need review';
  $('stFlagsWrap').hidden = flagged === 0;
  $('stFlagsWrap').title = reviewSummary(kinds, expiredOn);
}

// What the "entries need review" count is made of, shown when it is hovered
function reviewSummary(kinds, expiredOn) {
  const n = k => `${kinds[k]} ${kinds[k] > 1 ? 'entries' : 'entry'}`;
  const today = todayISO();
  const ended = expiredOn.filter(t => t < today).sort().pop();
  const out = [];
  if (kinds.expired) out.push(`${n('expired')}: SOR rates not valid today` + (ended ? ` (expired on ${fmtDate(ended)})` : '') +
    `. No rate date is set, so today's date (${fmtDate(today)}) was checked. Set Rates as on to the date of the work.`);
  if (kinds.norate) out.push(`${n('norate')}: no SOR rate ${rateContext()}.`);
  if (kinds.nosor) out.push(`${n('nosor')}: Service No not found in the SOR.`);
  if (kinds.dim) out.push(`${n('dim')}: a dimension can't be calculated.`);
  if (kinds.state) out.push(`${n('state')}: rate taken from a State's SOR, but no State is chosen.`);
  if (kinds.template) out.push(`${n('template')}: differ from the template they came from.`);
  if (out.length) out.push('Click the ! on an entry for details.');
  return out.join('\n\n');
}


function refreshLists() {
  const uniq = f => [...new Set(project.lines.map(l => (l[f] || '').trim()).filter(Boolean))].sort();
  $('poList').innerHTML = uniq('poItem').map(v => `<option value="${esc(v)}">`).join('');
  $('assetList').innerHTML = uniq('asset').map(v => `<option value="${esc(v)}">`).join('');
}

// The State box is always in the header, so the layout never shifts. With an
// SOR that names no States it is blank and greyed out. Otherwise it lists just
// those States and one is always chosen: a project can't take another State's
// rates. A State the SOR doesn't have is replaced by the first one it does.
function refreshStates() {
  const list = sorStates;
  const sel = $('projState');
  sel.disabled = !list.length;
  sel.title = list.length ? '' : 'This SOR has no State-specific rates';
  sel.innerHTML = list.length
    ? list.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')
    : '<option value=""></option>';
  const keep = list.find(s => sameState(s, project.state));
  const next = keep || list[0] || '';
  if (next !== project.state) {
    const old = project.state;
    if (old && list.length)
      setTimeout(() => toast(`State ${old} isn't in this SOR — using ${next}`), 0);
    project.state = next;
    pickCache = null;
  }
  sel.value = next;
}
function refreshDataInfo() {
  refreshStates();
  const custom = store.has(KEY_SOR) || store.has(KEY_BIS);
  const extra = SOR.items.length > sorMap.size ? ` (${SOR.items.length} rates)` : '';
  $('stData').innerHTML = `SOR <b>${sorMap.size}</b> items${extra} · BIS <b>${BIS.items.length}</b> sections` +
    (sorStates.length ? ` · State <b>${project.state ? esc(stateName(project.state)) : 'not chosen'}</b>` : '') +
    ` · rates as on <b>${project.date ? fmtDate(project.date) : 'today'}</b>` +
    (custom ? ' · <span title="Imported from CSV">custom data</span>' : '');
  $('stData').title = `SOR: ${SOR.source}\nBIS: ${BIS.source}` + (window.BUILD ? `\nBuilt ${fmtDate(window.BUILD.date)}` : '');
}

/* =====================================================================
   Editing
   ===================================================================== */
let dirty = false;
let saveTimer = null;
function changed(structural = false) {
  dirty = true;
  if (structural) renderAll(); else { refreshTotals(); }
  if (view === 'report') renderReport();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 400);
}
function autosave() {
  saveTimer = null;
  const ok = store.set(KEY_PROJECT, serializeProject());
  $('stSaved').textContent = ok ? 'Autosaved in this browser' : '';
}

tbody.addEventListener('focusin', e => {
  const inp = e.target.closest('input.cell');
  const tr = e.target.closest('tr');
  if (!tr) return;
  setCurrent(Number(tr.dataset.id));
  if (inp) {
    const line = lineById(Number(tr.dataset.id));
    inp.value = line[inp.dataset.f] ?? '';
    inp.select();
  }
});

tbody.addEventListener('focusout', e => {
  const inp = e.target.closest('input.cell');
  if (!inp) return;
  commitCell(inp);
});

// explicit = the user pressed Enter/arrow, so an unresolved Service No or
// steel section reopens its search even when the text has not changed.
function commitCell(inp, explicit = false) {
  const tr = inp.closest('tr');
  const line = tr && lineById(Number(tr.dataset.id));
  if (!line) return false;
  const f = inp.dataset.f;
  let val = f === 'desc' || f === 'poItem' || f === 'asset' ? inp.value : inp.value.trim();
  if (DIMS.includes(f)) val = normDim(val);
  if (val === (line[f] ?? '')) {
    // Text left unresolved earlier: cancelling this search clears it
    if (explicit && f === 'code' && val && !sorMap.has(val)) { openServiceSearch(line, val, ''); return true; }
    if (explicit && f === 'hd' && /^is/i.test(val) && evalExpr(val).error) { openBisPicker(line, val, { hd: '', hdSection: '' }); return true; }
    showCell(inp, line);
    return false;
  }
  let popup = false;

  if (f === 'code') {
    const prev = line.code;
    line.code = val;
    if (val && !sorMap.has(val)) { openServiceSearch(line, val, prev); popup = true; }
  } else if (f === 'hd') {
    const prev = { hd: line.hd, hdSection: line.hdSection };
    line.hd = val;
    line.hdSection = '';
    if (/^is/i.test(val) && evalExpr(val).error) {
      const exact = BIS.items.find(it => it.key === normSection(val));
      if (exact) { line.hd = String(exact.kgm); line.hdSection = exact.name; }
      else { openBisPicker(line, val, prev); popup = true; }
    }
  } else {
    line[f] = val;
  }
  if (f === 'code') refreshRow(line); else { showCell(inp, line); updateRow(tr, line, indexOfId(line.id)); }
  changed();
  if (f === 'poItem' || f === 'asset') refreshLists();
  return popup;
}

function setCurrent(id) {
  if (currentId === id) return;
  rowEl(currentId)?.classList.remove('current');
  currentId = id;
  rowEl(id)?.classList.add('current');
}

function focusCell(id, field) {
  const inp = rowEl(id)?.querySelector(`input[data-f="${field}"]`);
  if (inp) { inp.focus(); inp.scrollIntoView({ block: 'nearest' }); }
}

tbody.addEventListener('keydown', e => {
  const inp = e.target.closest('input.cell');
  if (!inp) return;
  const tr = inp.closest('tr');
  const id = Number(tr.dataset.id);
  const idx = indexOfId(id);
  const f = inp.dataset.f;
  // Ctrl+D fills the cell from the one above, as in Excel. A Service No brings
  // its Short Text, Unit and Price with it; H/D brings its steel section.
  if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault(); // instead of the browser's "bookmark this page"
    const line = lineById(id), above = project.lines[idx - 1];
    if (!above) return toast('There is no row above to copy from');
    line[f] = above[f];
    if (f === 'hd') line.hdSection = above.hdSection;
    refreshRow(line);
    inp.value = line[f] ?? ''; // still editing: show it as typed, cursor at the end
    inp.setSelectionRange(inp.value.length, inp.value.length);
    changed();
    if (f === 'poItem' || f === 'asset') refreshLists();
    return;
  }
  // Tab from the last field (Asset) goes to the next row's Service No,
  // adding a row first when this is the last one
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && f === 'asset') {
    e.preventDefault();
    commitCell(inp, true);
    if (idx === project.lines.length - 1) {
      const cur = lineById(id);
      addRows(project.lines.length, [newLine({ poItem: cur.poItem, asset: cur.asset })]);
    }
    focusCell(project.lines[idx + 1].id, 'code');
    return;
  }
  if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // Arrows move between rows; Alt+↓ still opens the PO Item / Asset suggestions
    if ((f === 'poItem' || f === 'asset') && e.key !== 'Enter' && e.altKey) return;
    e.preventDefault();
    // A search popup opening from this commit takes over focus
    if (commitCell(inp, true)) return;
    const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey);
    let target = idx + (up ? -1 : 1);
    if (target >= project.lines.length && e.key === 'Enter') {
      const cur = lineById(id);
      addRows(project.lines.length, [newLine({ poItem: cur.poItem, asset: cur.asset })]);
      target = project.lines.length - 1;
    }
    if (target < 0 || target >= project.lines.length) return;
    focusCell(project.lines[target].id, f);
  } else if (e.key === 'Escape') {
    const line = lineById(id);
    inp.value = line[f] ?? '';
    inp.select();
  }
});

tbody.addEventListener('click', e => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  setCurrent(id);
  if (e.target.closest('.info')) { showLongText(lineById(id)); return; }
  if (e.target.closest('.flag')) { showFlags(lineById(id)); return; }
  if (e.target.classList.contains('rowchk')) {
    if (e.target.checked) checked.add(id); else checked.delete(id);
    tr.classList.toggle('checked', e.target.checked);
    $('chkAll').checked = checked.size === project.lines.length;
    setCurrent(id);
  }
});

$('chkAll').addEventListener('change', e => {
  checked.clear();
  if (e.target.checked) project.lines.forEach(l => checked.add(l.id));
  renderAll();
});

/* ---------- row operations ---------- */
function targetIds() {
  if (checked.size) return project.lines.filter(l => checked.has(l.id)).map(l => l.id);
  return currentId != null && lineById(currentId) ? [currentId] : [];
}
function addRows(at, lines) {
  project.lines.splice(at, 0, ...lines);
  changed(true);
}
$('btnAdd').onclick = () => {
  const last = project.lines[project.lines.length - 1];
  const l = newLine({ poItem: last?.poItem || '', asset: last?.asset || '' });
  addRows(project.lines.length, [l]);
  focusCell(l.id, 'code');
};
$('btnInsert').onclick = () => {
  const idx = currentId != null ? indexOfId(currentId) : -1;
  const at = idx < 0 ? project.lines.length : idx;
  const ref = project.lines[at];
  const l = newLine({ poItem: ref?.poItem || '', asset: ref?.asset || '' });
  addRows(at, [l]);
  focusCell(l.id, 'code');
};
$('btnDup').onclick = () => {
  const ids = targetIds();
  if (!ids.length) return toast('Select a row first');
  const lastIdx = Math.max(...ids.map(indexOfId));
  const copies = ids.map(id => newLine({ ...structuredClone(lineById(id)), id: nextId++ }));
  addRows(lastIdx + 1, copies);
  toast(`Duplicated ${copies.length} ${copies.length > 1 ? 'entries' : 'entry'}`);
};
/* ---------- delete with optional confirmation, and undo ---------- */
const KEY_CONFIRM_DEL = 'boq.confirmDelete';
let askBeforeDelete = store.get(KEY_CONFIRM_DEL) ?? true;
let undoStack = []; // [{ label, lines: [[index, line], …] }]

function deleteLines(ids, label) {
  const set = new Set(ids);
  const removed = [];
  project.lines.forEach((l, i) => { if (set.has(l.id)) removed.push([i, l]); });
  project.lines = project.lines.filter(l => !set.has(l.id));
  ids.forEach(id => checked.delete(id));
  if (set.has(currentId)) currentId = null;
  undoStack.push({ label, lines: removed });
  if (undoStack.length > 20) undoStack.shift();
  changed(true);
  toast(label, { text: 'Undo', run: undoDelete });
}
function undoDelete() {
  const u = undoStack.pop();
  if (!u) return toast('Nothing to undo');
  for (const [i, l] of u.lines) project.lines.splice(Math.min(i, project.lines.length), 0, l);
  changed(true);
  toast(`Restored ${u.lines.length} ${u.lines.length > 1 ? 'entries' : 'entry'}`);
  rowEl(u.lines[0][1].id)?.scrollIntoView({ block: 'nearest' });
}
function deleteSelected() {
  const ids = targetIds();
  if (!ids.length) return toast('Select a row first');
  const label = `Deleted ${ids.length} ${ids.length > 1 ? 'entries' : 'entry'}`;
  if (!askBeforeDelete) return deleteLines(ids, label);
  $('delText').textContent = ids.length === 1
    ? `Delete entry ${indexOfId(ids[0]) + 1}${lineById(ids[0]).code ? ' (' + lineById(ids[0]).code + ')' : ''}?`
    : `Delete ${ids.length} checked entries?`;
  $('delDontAsk').checked = false;
  const dlg = $('dlgDelete');
  dlg.returnValue = '';
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    if ($('delDontAsk').checked) setAskBeforeDelete(false);
    deleteLines(ids, label);
  };
  dlg.showModal();
}
function setAskBeforeDelete(v) {
  askBeforeDelete = v;
  store.set(KEY_CONFIRM_DEL, v);
  $('menuConfirmDel').textContent = `Ask before deleting rows: ${v ? 'On' : 'Off'}`;
}
$('btnDel').onclick = deleteSelected;
$('btnClear').onclick = () => {
  const n = project.lines.length;
  if (!n) return toast('The sheet is already empty');
  if (!confirm(`Delete all ${n} entries from the sheet?\n\nProject name, rate date and discount are kept. ` +
    'Undo (Ctrl+Z) brings them back until you close or reload the page.')) return;
  deleteLines(project.lines.map(l => l.id), `Cleared ${n} ${n > 1 ? 'entries' : 'entry'}`);
};
function moveRows(dir) {
  const ids = targetIds();
  if (!ids.length) return toast('Select a row first');
  const set = new Set(ids);
  const L = project.lines;
  if (dir < 0) {
    for (let i = 1; i < L.length; i++) if (set.has(L[i].id) && !set.has(L[i - 1].id)) [L[i - 1], L[i]] = [L[i], L[i - 1]];
  } else {
    for (let i = L.length - 2; i >= 0; i--) if (set.has(L[i].id) && !set.has(L[i + 1].id)) [L[i + 1], L[i]] = [L[i], L[i + 1]];
  }
  changed(true);
  if (ids.length === 1) rowEl(ids[0])?.scrollIntoView({ block: 'nearest' });
}
$('btnUp').onclick = () => moveRows(-1);
$('btnDown').onclick = () => moveRows(1);

/* ---------- discount & name ---------- */
// Discount %: a number with up to 2 decimal places. Prices follow it as it is
// typed ("1." already counts as 1); a third decimal or a letter can't be
// typed, and a lone "-" or "." is outlined and ignored. On leaving the field
// it is shown with 2 decimals ("1." → "1.00").
const DISCOUNT_OK = /^-?\d*(\.\d{0,2})?$/;
let discountTyped = '';
// Entering the field selects its value, so typing replaces "1.00" rather than
// adding a third decimal to it
let discountJustFocused = false;
$('discount').addEventListener('focus', e => { discountTyped = e.target.value; e.target.select(); discountJustFocused = true; });
// the click that focused the field would otherwise drop that selection again
$('discount').addEventListener('mouseup', e => { if (discountJustFocused) e.preventDefault(); discountJustFocused = false; });
$('discount').addEventListener('input', e => {
  const el = e.target;
  // a pasted value with more decimals keeps the first two ("12.345" → "12.34")
  const cut = el.value.trim().replace(/^(-?\d*\.\d{2})\d+$/, '$1');
  if (cut !== el.value.trim() && DISCOUNT_OK.test(cut)) el.value = cut;
  if (!DISCOUNT_OK.test(el.value.trim())) {
    const at = el.selectionStart - (el.value.length - discountTyped.length);
    el.value = discountTyped;
    el.setSelectionRange(at, at);
    return;
  }
  discountTyped = el.value;
  const v = el.value.trim();
  const partial = /^-?\.?$/.test(v) && v !== '';
  el.classList.toggle('bad', partial);
  if (partial) return;
  const next = v === '' ? '' : String(Number(v));
  if (String(Number(project.discount || 0)) === String(Number(next || 0)) && !!next === !!project.discount) return;
  project.discount = next;
  for (const line of project.lines) refreshRow(line);
  changed();
});
$('discount').addEventListener('change', e => {
  project.discount = fmtDiscount(project.discount);
  e.target.value = project.discount;
  e.target.classList.remove('bad');
  discountTyped = e.target.value;
  changed();
});
// "1" / "1." / "1.5" → "1.00" / "1.00" / "1.50"; blank stays blank
function fmtDiscount(v) {
  const n = evalExpr(v).value;
  return n === null || n === undefined ? '' : (Math.round(n * 100) / 100 + 0).toFixed(2);
}
$('projName').addEventListener('change', e => { project.name = e.target.value; changed(); });
// Rate date and State both decide which SOR rate prices each line
function rateBasisChanged() {
  pickCache = null;
  for (const line of project.lines) refreshRow(line);
  changed();
  refreshDataInfo();
  const missing = project.lines.filter(l => { const c = compute(l); return c.look && !c.sor; }).length;
  if (missing) toast(`${missing} ${missing > 1 ? 'entries have' : 'entry has'} no SOR rate ${rateContext()}`);
}
$('rateDate').addEventListener('change', e => { project.date = e.target.value; rateBasisChanged(); });
$('projState').addEventListener('change', e => { project.state = e.target.value; rateBasisChanged(); });
