/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Pick lists (service search & BIS)
   ===================================================================== */
function makePicker({ dlg, search, list, count, ok, filter, row, onPick, onCancel }) {
  let results = [], sel = 0, picked = false;
  function draw() {
    results = filter(search.value);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    const shown = results.slice(0, 400);
    let html = '';
    if (!shown.length) html = '<div class="none">No matches. Change the search text.</div>';
    else {
      html = '<table>';
      let lastGroup = null;
      shown.forEach((it, i) => {
        if (it.group !== undefined && it.group !== lastGroup) {
          lastGroup = it.group;
          html += `<tr class="group"><td colspan="4">${esc(it.group)}</td></tr>`;
        }
        html += `<tr data-i="${i}" class="${i === sel ? 'sel' : ''}">${row(it)}</tr>`;
      });
      html += '</table>';
    }
    list.innerHTML = html;
    count.textContent = results.length > shown.length
      ? `${results.length} matches (showing first ${shown.length})` : `${results.length} match${results.length === 1 ? '' : 'es'}`;
    ok.disabled = !results.length;
    scrollSel();
  }
  function scrollSel() { list.querySelector('tr.sel')?.scrollIntoView({ block: 'nearest' }); }
  function move(d) {
    if (!results.length) return;
    sel = Math.max(0, Math.min(Math.min(results.length, 400) - 1, sel + d));
    list.querySelectorAll('tr.sel').forEach(t => t.classList.remove('sel'));
    list.querySelector(`tr[data-i="${sel}"]`)?.classList.add('sel');
    scrollSel();
  }
  function pick() {
    if (!results.length) return;
    picked = true;
    dlg.close();
    onPick(results[sel]);
  }
  search.addEventListener('input', () => { sel = 0; draw(); });
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); move(10); }
    else if (e.key === 'PageUp') { e.preventDefault(); move(-10); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(); }
  });
  list.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    sel = Number(tr.dataset.i);
    list.querySelectorAll('tr.sel').forEach(t => t.classList.remove('sel'));
    tr.classList.add('sel');
    search.focus();
  });
  list.addEventListener('dblclick', e => { if (e.target.closest('tr[data-i]')) pick(); });
  ok.addEventListener('click', pick);
  dlg.addEventListener('close', () => { if (!picked) onCancel?.(); });
  return {
    open(text) { picked = false; search.value = text; sel = 0; dlg.showModal(); draw(); search.focus(); search.select(); },
  };
}

let svcTarget = null;
const svcPicker = makePicker({
  dlg: $('dlgService'), search: $('svcSearch'), list: $('svcList'), count: $('svcCount'), ok: $('svcOk'),
  filter(q) {
    const words = q.toUpperCase().split(/\s+/).filter(Boolean);
    if (!words.length) return pickItems();
    return pickItems().filter(it => {
      const hay = (it.short + ' ' + it.code).toUpperCase();
      return words.every(w => hay.includes(w));
    });
  },
  row: it => `<td>${esc(it.code)}</td><td class="wrap">${esc(it.short)}</td><td>${esc(it.unit)}</td>` +
    (it.valid ? `<td style="text-align:right">${fmtMoney(it.rate)}</td>`
              : `<td style="text-align:right" class="norate" title="No SOR rate ${esc(rateContext())}">—</td>`),
  onPick(it) {
    const line = svcTarget;
    line.code = String(it.code);
    refreshRow(line);
    changed();
    focusCell(line.id, 'desc');
  },
  // Esc / Cancel puts back what the cell held before the search text was typed
  onCancel() {
    if (!svcTarget) return;
    svcTarget.code = svcPrev;
    refreshRow(svcTarget);
    changed();
    focusCell(svcTarget.id, 'code');
  },
});
let svcPrev = '';
function openServiceSearch(line, text, prev) {
  svcTarget = line;
  svcPrev = prev;
  setTimeout(() => svcPicker.open(text), 0);
}

let bisTarget = null;
const bisPicker = makePicker({
  dlg: $('dlgBis'), search: $('bisSearch'), list: $('bisList'), count: $('bisCount'), ok: $('bisOk'),
  filter(q) {
    const k = normSection(q);
    if (!k) return BIS.items;
    const pre = BIS.items.filter(it => it.key.startsWith(k));
    return pre.length ? pre : BIS.items.filter(it => it.key.includes(k));
  },
  row: it => `<td>${esc(it.name)}</td><td style="text-align:right">${it.kgm} kg/m</td>`,
  onPick(it) {
    const line = bisTarget;
    line.hd = String(it.kgm);
    line.hdSection = it.name;
    refreshRow(line);
    changed();
    focusCell(line.id, 'hd');
  },
  onCancel() {
    if (!bisTarget) return;
    Object.assign(bisTarget, bisPrev);
    refreshRow(bisTarget);
    changed();
    focusCell(bisTarget.id, 'hd');
  },
});
let bisPrev = { hd: '', hdSection: '' };
function openBisPicker(line, text, prev) {
  bisTarget = line;
  bisPrev = prev;
  setTimeout(() => bisPicker.open(text), 0);
}

document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

/* =====================================================================
   Long text & flags
   ===================================================================== */
function showLongText(line) {
  const look = line && line.code ? sorLookup(line.code) : null;
  if (!look) return toast(line?.code ? `Service No ${line.code} is not in the SOR` : 'Enter a Service No first');
  hideCard();
  const it = look.info;
  $('longHead').textContent = `${it.code} — ${it.short}`;
  $('longKv').innerHTML = `<dt>Unit</dt><dd>${esc(it.unit)}</dd>` + ratesHtml(look);
  $('longText').innerHTML = it.long ? longTextHtml(it.long) : '(No long text in SOR)';
  $('dlgLong').showModal();
}
// Rate line(s) for the hover card and long text dialog: every validity period
// on file, with the one used on the rate date marked.
function ratesHtml(look) {
  const d = project.date;
  const status = !look.entry ? `No rate ${rateContext()}`
    : (d ? `Valid on ${fmtDate(d)}`
       : look.outOfDate ? `Rate ${validityNote(look.entry)} — latest rate on file used (no rate date set)`
       : 'Valid today (no rate date set)') + (project.state ? ` · ${stateName(project.state)}` : '');
  const anyState = look.entries.some(e => e.states.length);
  const rows = look.entries.map(e => {
    const used = e === look.entry;
    return `<tr class="${used ? 'used' : ''}">${anyState ? `<td>${esc(statesText(e.states))}</td>` : ''}` +
      `<td>${esc(fmtPeriod(e))}</td><td class="r">${fmtMoney(e.rate)}</td><td>${used ? '✓ in use' : ''}</td></tr>`;
  }).join('');
  return `<dt>Rate</dt><dd><table class="rates">${rows}</table>` +
    `<div class="rstat ${look.entry && !look.outOfDate ? '' : 'bad'}">${esc(status)}</div></dd>`;
}

/* ---------- drawing references in long text ---------- */
// "as per std drg no STD.DRG.101", "drawing No. AB.95.04.008B", "drg. C/R-54 (E.IS.04.004)"
const DRG_ID = String.raw`[A-Z][A-Z0-9]*(?:\s?&\s?[A-Z0-9]+)?(?:[./-][A-Z0-9&]+)+`;
const DRG_RX = new RegExp(String.raw`((?:drg|drawing)s?\.?\s*(?:no\.?|number)?\s*[.:]?\s*)(${DRG_ID})(?:(\s*\()(${DRG_ID})\))?`, 'gi');
let drawingCfg = { folder: 'drawings/', ext: '.pdf' };
const drawingHref = id => drawingCfg.folder + encodeURIComponent(id.replace(/[\/\\:*?"<>|]/g, '-') + drawingCfg.ext);
// "D:\Drawings", "\\server\share" or "/home/me/drawings" → a file:/// address
// the browser can open
function folderUrl(f) {
  f = f.trim();
  if (!f) return '';
  if (/^[A-Za-z]:[\\/]/.test(f)) f = 'file:///' + f.replace(/\\/g, '/');
  else if (/^\/(?!\/)/.test(f)) f = 'file://' + f;
  else if (/^\\\\/.test(f)) f = 'file:' + f.replace(/\\/g, '/');
  return /\/$/.test(f) ? f : f + '/';
}
// Long text as HTML with each drawing number linked to its file
function longTextHtml(text) {
  let out = '', last = 0;
  for (const m of text.matchAll(DRG_RX)) {
    const ids = [m[2], m[4]].filter(Boolean);
    if (!ids.some(id => /\d/.test(id))) continue;
    out += esc(text.slice(last, m.index)) + esc(m[1]);
    out += drgLink(m[2]);
    if (m[4]) out += esc(m[3]) + drgLink(m[4]) + ')';
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
// A page served from the web may not open files on this computer: browsers
// silently ignore such links, so say why and copy the address instead
document.addEventListener('click', e => {
  const a = e.target.closest('a.drg');
  if (!a || location.protocol === 'file:' || !a.href.startsWith('file:')) return;
  e.preventDefault();
  navigator.clipboard?.writeText(a.href).catch(() => {});
  toast('Browsers don\'t let a web page open files on your computer. The drawing\'s address is copied: paste it into a new tab, or use MBook from a downloaded copy.');
});
function drgLink(raw) {
  // A word run on after the number ("Q-119filling") stays plain text
  const t = /\d([A-Za-z]{2,})$/.exec(raw);
  const rest = t ? t[1] : '';
  const id = raw.slice(0, raw.length - rest.length).replace(/\s+/g, '');
  if (!/\d/.test(id)) return esc(raw);
  const href = drawingHref(id);
  return `<a class="drg" href="${esc(href)}" target="_blank" rel="noopener" title="Open drawing ${esc(id)}: ${esc(href)}">${esc(id)}</a>` + esc(rest);
}

/* ---------- hover card on Service No ---------- */
const card = $('hoverCard');
let cardTimer = null, cardHideTimer = null, cardLineId = null;
tbody.addEventListener('mouseover', e => {
  const td = e.target.closest('td.c-code');
  if (!td) return;
  const id = Number(td.parentElement.dataset.id);
  clearTimeout(cardHideTimer);
  if (cardLineId === id && card.classList.contains('show')) return;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => showCard(id, td), 450);
});
tbody.addEventListener('mouseout', e => {
  const td = e.target.closest('td.c-code');
  if (!td || td.contains(e.relatedTarget)) return;
  clearTimeout(cardTimer);
  scheduleHide();
});
card.addEventListener('mouseenter', () => clearTimeout(cardHideTimer));
card.addEventListener('mouseleave', scheduleHide);
card.addEventListener('click', e => {
  if (e.target.closest('a.drg')) return; // drawing link opens on its own
  const l = lineById(cardLineId); if (l) showLongText(l);
});
$('main').addEventListener('scroll', hideCard, { passive: true });
document.addEventListener('keydown', hideCard, true);
function scheduleHide() { clearTimeout(cardHideTimer); cardHideTimer = setTimeout(hideCard, 250); }
function hideCard() {
  clearTimeout(cardTimer); clearTimeout(cardHideTimer);
  card.classList.remove('show'); cardLineId = null;
}
// The card is for looking a code up, not for typing one: not while that
// Service No cell is being edited
const editingCode = td => document.activeElement === td.querySelector('input.cell');
tbody.addEventListener('focusin', e => { if (e.target.closest('td.c-code')) hideCard(); });
function showCard(id, td) {
  const line = lineById(id);
  const look = line && sorLookup(line.code);
  if (!look || document.querySelector('dialog[open]') || editingCode(td)) return hideCard();
  const it = look.info;
  card.style.width = ''; // let it size to this item's rates before measuring
  card.innerHTML = `<div class="hc-head"><b>${esc(it.code)}</b> &nbsp;${esc(it.short)}</div>` +
    `<dl class="kv"><dt>Unit</dt><dd>${esc(it.unit)}</dd>${ratesHtml(look)}</dl>` +
    `<div class="hc-long">${it.long ? longTextHtml(it.long) : 'No long text in SOR.'}</div>` +
    `<div class="hc-foot">Click for the full scope of work</div>`;
  cardLineId = id;
  card.classList.add('show');
  const r = td.getBoundingClientRect(), h = card.offsetHeight, w = card.offsetWidth;
  let top = r.bottom + 4;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
  card.style.top = top + 'px';
  card.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
}

let flagTarget = null;
function showFlags(line) {
  const c = compute(line);
  const flags = flagsFor(line, c);
  flagTarget = line;
  $('flagHead').textContent = `Entry ${indexOfId(line.id) + 1}${line.code ? ' — ' + line.code : ''}`;
  $('flagList').innerHTML = flags.map(f => `<li>${esc(f.text)}</li>`).join('');
  const reviewable = !!line.ref && flags.some(f => f.level === 'warn');
  $('flagAccept').hidden = !reviewable;
  $('flagNote').textContent = reviewable
    ? (line.ref.template ? `Imported from template “${line.ref.template}”. ` : '') +
      'Mark reviewed once you have checked this entry; the template values are then forgotten.'
    : '';
  $('dlgFlag').showModal();
}
$('flagAccept').onclick = () => {
  if (flagTarget) { flagTarget.ref = null; refreshRow(flagTarget); changed(); }
  $('dlgFlag').close();
};

document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === 'I' || e.key === 'i')) {
    e.preventDefault();
    if (currentId != null && !document.querySelector('dialog[open]')) showLongText(lineById(currentId));
  } else if (e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    saveProject();
  } else if (document.querySelector('dialog[open]') || view !== 'sheet') {
    // shortcuts below act on the sheet only
  } else if (isTyping(e.target)) {
    // Delete / Ctrl+Z inside a cell edit its text as usual
  } else if (e.key === 'Delete') {
    e.preventDefault();
    deleteSelected();
  } else if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    undoDelete();
  }
});
// Enter in a dialog's text box confirms it. Left to the browser, it would press
// the first button in the form, which is Cancel.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return;
  const el = e.target, form = el.closest?.('dialog form[method="dialog"]');
  if (!form || el.tagName !== 'INPUT' || ['checkbox', 'radio', 'button', 'submit'].includes(el.type)) return;
  e.preventDefault();
  const ok = form.querySelector('.primary');
  if (ok && !ok.disabled) ok.click();
});
const isTyping = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
  (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));
