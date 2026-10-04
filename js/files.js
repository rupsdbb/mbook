/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Files: project (.boq), template (.boqt), CSV
   ===================================================================== */
function pickFile(accept) {
  return new Promise(resolve => {
    const fi = $('fileInput');
    fi.value = '';
    fi.accept = accept;
    fi.multiple = false;
    fi.onchange = () => resolve(fi.files[0] || null);
    fi.click();
  });
}
function readText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
}
function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const safeName = s => (s || '').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'untitled';

function serializeProject() {
  return {
    format: 'boq-project', version: 1, app: APP_ID, name: project.name, state: project.state, date: project.date, discount: project.discount,
    savedAt: new Date().toISOString(), sorSource: SOR.source,
    lines: project.lines.map(l => ({
      serviceNo: l.code, description: l.desc, no: l.no, l: l.l, b: l.b, hd: l.hd, hdSection: l.hdSection,
      poItem: l.poItem, asset: l.asset, ...(l.ref ? { ref: l.ref } : {}),
    })),
  };
}
const asStr = v => v === null || v === undefined ? '' : String(v);
// Template values kept on a line for review; anything malformed is dropped
function cleanRef(r) {
  if (!r || typeof r !== 'object') return null;
  const num = Number(r.qty);
  return {
    template: asStr(r.template),
    short: r.short == null ? null : asStr(r.short),
    unit: r.unit == null ? null : asStr(r.unit),
    qty: r.qty === '' || r.qty == null || !isFinite(num) ? null : num,
  };
}
function loadProject(data) {
  if (!data || data.format !== 'boq-project' || !Array.isArray(data.lines)) throw new Error('Not a BOQ project file');
  project = newProject();
  project.name = asStr(data.name);
  project.discount = fmtDiscount(asStr(data.discount));
  project.date = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : '';
  project.state = asStr(data.state).trim();
  pickCache = null;
  project.lines = data.lines.filter(l => l && typeof l === 'object').map(l => newLine({
    code: asStr(l.serviceNo).trim(), desc: asStr(l.description),
    no: normDim(asStr(l.no)), l: normDim(asStr(l.l)), b: normDim(asStr(l.b)), hd: normDim(asStr(l.hd)),
    hdSection: asStr(l.hdSection), poItem: asStr(l.poItem), asset: asStr(l.asset), ref: cleanRef(l.ref),
  }));
  checked.clear(); currentId = null;
  undoStack = []; // undo history belongs to the project it came from
  $('projName').value = project.name;
  $('discount').value = project.discount;
  $('rateDate').value = project.date;
  refreshDataInfo();
  renderAll();
  if (view === 'report') renderReport();
}

let fileHandle = null;
async function saveProject() {
  const text = JSON.stringify(serializeProject(), null, 1);
  const name = safeName(project.name) + '.boq';
  if (window.showSaveFilePicker) {
    try {
      if (!fileHandle) fileHandle = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'BOQ project', accept: { 'application/json': ['.boq'] } }] });
      const w = await fileHandle.createWritable();
      await w.write(text); await w.close();
      dirty = false; toast(`Saved ${fileHandle.name}`);
      $('stSaved').textContent = `Saved to ${fileHandle.name}`;
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      fileHandle = null; // fall back to a download
    }
  }
  download(name, text);
  dirty = false;
  toast(`Downloaded ${name}`);
}
$('btnSave').onclick = saveProject;

$('btnOpen').onclick = async () => {
  if (dirty && project.lines.length && !confirm('Open another project? Unsaved changes in this one will be lost (save first if needed).')) return;
  let file, handle = null;
  if (window.showOpenFilePicker) {
    try {
      [handle] = await showOpenFilePicker({ types: [{ description: 'BOQ project', accept: { 'application/json': ['.boq'] } }] });
      file = await handle.getFile();
    } catch (err) { if (err.name === 'AbortError') return; }
  }
  if (!file) file = await pickFile('.boq,.json');
  if (!file) return;
  try {
    loadProject(JSON.parse(await readText(file)));
    fileHandle = handle;
    dirty = false; autosave();
    toast(`Opened ${file.name}`);
  } catch (err) { alert(`Could not open ${file.name}: ${err.message}`); }
};

$('btnNew').onclick = () => {
  if (project.lines.length && !confirm('Start a new project? Unsaved changes in this one will be lost (save first if needed).')) return;
  loadProject(newProject());
  fileHandle = null;
  autosave(); dirty = false;
};

/* ---------- templates ---------- */
let pendingTpl = null;
$('btnImportTpl').onclick = async () => {
  const file = await pickFile('.boqt,.json');
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await readText(file));
    if (data.format !== 'boq-template' || !Array.isArray(data.lines)) throw new Error('Not a BOQ template file');
  } catch (err) { return alert(`Could not read ${file.name}: ${err.message}`); }
  pendingTpl = { data, file: file.name };
  const name = data.name || file.name.replace(/\.[^.]+$/, '');
  $('tplName').textContent = `${name} · ${data.lines.length} ${data.lines.length === 1 ? 'entry' : 'entries'}`;
  $('tplPo').value = '';
  $('tplAsset').value = name;
  $('tplWhere').value = currentId != null ? 'after' : 'end';
  const unknown = data.lines.filter(l => l.serviceNo && !sorMap.has(asStr(l.serviceNo).trim())).length;
  $('tplNote').textContent = 'Short Text, Unit and Price come from the current SOR, and Qty is recalculated from No × L × B × H/D. ' +
    'Entries where the template disagrees are flagged for review.' + (unknown ? ` ${unknown} service no(s) are not in the SOR.` : '');
  $('dlgTpl').returnValue = '';
  $('dlgTpl').showModal();
};
$('dlgTpl').addEventListener('close', () => {
  if ($('dlgTpl').returnValue !== 'ok' || !pendingTpl) { pendingTpl = null; return; }
  const { data } = pendingTpl;
  const tplName = data.name || pendingTpl.file;
  const po = $('tplPo').value.trim(), asset = $('tplAsset').value.trim();
  const lines = data.lines.filter(t => t && typeof t === 'object').map(t => newLine({
    code: asStr(t.serviceNo).trim(), desc: asStr(t.description),
    no: normDim(asStr(t.no)), l: normDim(asStr(t.l)), b: normDim(asStr(t.b)), hd: normDim(asStr(t.hd)),
    hdSection: asStr(t.hdSection), poItem: po, asset,
    ref: cleanRef({ template: tplName, short: t.shortText, unit: t.unit, qty: t.qty }),
  }));
  // Lines whose template values already agree carry nothing to review
  for (const l of lines) if (!flagsFor(l, compute(l)).some(f => f.level === 'warn')) l.ref = null;
  const idx = currentId != null ? indexOfId(currentId) : -1;
  const at = $('tplWhere').value === 'after' && idx >= 0 ? idx + 1 : project.lines.length;
  addRows(at, lines);
  pendingTpl = null;
  const flagged = lines.filter(l => flagsFor(l, compute(l)).length).length;
  toast(`Imported ${lines.length} ${lines.length === 1 ? 'entry' : 'entries'} from ${tplName}` + (flagged ? ` · ${flagged} ${flagged > 1 ? 'entries need' : 'entry needs'} review` : ''));
  rowEl(lines[0]?.id)?.scrollIntoView({ block: 'center' });
});

let exportIds = [];
$('btnExportTpl').onclick = () => {
  exportIds = checked.size ? targetIds() : project.lines.map(l => l.id);
  if (!exportIds.length) return toast('Nothing to export');
  const first = lineById(exportIds[0]);
  $('tplOutName').value = first?.asset || '';
  $('tplOutNote').textContent = `${exportIds.length} ${exportIds.length > 1 ? 'entries' : 'entry'} (${checked.size ? 'checked entries' : 'all entries — check entries to export only some'}). ` +
    'PO Item and Asset are not stored in templates.';
  $('dlgTplOut').returnValue = '';
  $('dlgTplOut').showModal();
};
$('dlgTplOut').addEventListener('close', () => {
  if ($('dlgTplOut').returnValue !== 'ok') return;
  const name = $('tplOutName').value.trim();
  const out = {
    format: 'boq-template', version: 1, app: APP_ID, name, createdAt: new Date().toISOString(), sorSource: SOR.source,
    lines: exportIds.map(id => {
      const l = lineById(id), c = compute(l);
      return {
        serviceNo: l.code, shortText: c.info?.short ?? '', description: l.desc,
        no: l.no, l: l.l, b: l.b, hd: l.hd, ...(l.hdSection ? { hdSection: l.hdSection } : {}),
        unit: c.info?.unit ?? '', qty: isNaN(c.qty) ? null : c.qty,
      };
    }),
  };
  download(safeName(name) + '.boqt', JSON.stringify(out, null, 1));
  toast(`Exported template ${name}`);
});

/* ---------- CSV import for SOR / BIS ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
const toNum = s => { const v = parseFloat(String(s).replace(/,/g, '')); return isFinite(v) ? v : null; };

function sorFromCSV(rows) {
  // Columns as in the SOR sheet: Service No, Short Text, Rate, Unit, Valid From, Valid To, Long Text,
  // and optionally State. Header names are matched when present; otherwise that order is assumed.
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const find = re => head.findIndex(h => re.test(h));
  let col = { code: find(/service\s*(no|number|code)|^code/), short: find(/short/), rate: find(/rate|price/),
    unit: find(/^un(it)?s?$/), from: find(/valid\s*from/), to: find(/valid\s*to/), long: find(/long/),
    state: find(/^state/) };
  let start = 1;
  if (col.code < 0 || col.short < 0 || col.rate < 0 || col.unit < 0) {
    col = { code: 0, short: 1, rate: 2, unit: 3, from: 4, to: 5, long: 6, state: 7 };
    start = toNum(rows[0][0]) === null ? 1 : 0;
  }
  const items = [], seen = new Set();
  for (const r of rows.slice(start)) {
    const code = (r[col.code] || '').trim(), rate = toNum(r[col.rate]);
    if (!code || rate === null) continue;
    const from = col.from >= 0 ? normDate(r[col.from]) : '', to = col.to >= 0 ? normDate(r[col.to]) : '';
    const state = col.state >= 0 ? (r[col.state] || '').trim() : '';
    const key = sorKey({ code, from, to, state });
    if (seen.has(key)) continue;
    seen.add(key);
    const long = col.long >= 0 ? (r[col.long] || '').trim() : '';
    items.push({ code, short: (r[col.short] || '').trim(), rate, unit: (r[col.unit] || '').trim(),
      from, to, long: long === '#N/A' ? '' : long, ...(state ? { state } : {}) });
  }
  items.hasState = col.state >= 0;
  return items;
}
const sorKey = it => `${it.code}|${it.from || ''}|${it.to || ''}|${String(it.state || '').trim().toUpperCase()}`;
// SOR dates arrive as 2025-02-03, 03.02.2025 (SAP), 03-02-2025 or 03/02/2025 — day first.
function normDate(v) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}
function bisFromCSV(rows) {
  // Columns as in the BIS sheet: Designation, kg/m, Group (group only on the first row of each group).
  const items = []; let group = '';
  for (const r of rows) {
    if ((r[2] || '').trim()) group = r[2].trim();
    const name = (r[0] || '').trim(), kgm = toNum(r[1]);
    if (!/^IS/i.test(name) || kgm === null) continue;
    items.push({ name, kgm, group });
  }
  return items;
}

document.querySelector('#btnData').onclick = e => { e.stopPropagation(); $('menuData').classList.toggle('open'); };
document.addEventListener('click', () => $('menuData').classList.remove('open'));
$('menuData').addEventListener('click', async e => {
  const act = e.target.dataset.act;
  if (!act) return;
  $('menuData').classList.remove('open');
  if (act === 'confirm-del') {
    setAskBeforeDelete(!askBeforeDelete);
    return toast(askBeforeDelete ? 'Row deletes will ask first' : 'Rows delete straight away (Undo is still available)');
  }
  if (act === 'drawings') {
    const folder = prompt('Folder holding the drawings: relative to this page (drawings/), a full path (D:\\Drawings) or a web address.\n' +
      'A drawing number such as STD.DRG.101 opens <folder>STD.DRG.101' + drawingCfg.ext + ' — "/" in a number becomes "-".', drawingCfg.folder);
    if (folder === null) return;
    const ext = prompt('File extension of the drawings:', drawingCfg.ext);
    if (ext === null) return;
    drawingCfg = { folder: folderUrl(folder),
      ext: ext.trim().startsWith('.') || !ext.trim() ? ext.trim() : '.' + ext.trim() };
    store.set(KEY_DRG, drawingCfg);
    return toast(`Drawings open from ${drawingCfg.folder}…${drawingCfg.ext}`);
  }
  if (act === 'restore') {
    if (!confirm('Go back to the SOR and BIS built into this tool?')) return;
    store.del(KEY_SOR); store.del(KEY_BIS);
    reloadData(); return toast('Built-in SOR and BIS restored');
  }
  const file = await pickFile('.csv,text/csv');
  if (!file) return;
  const rows = parseCSV(await readText(file));
  if (act === 'sor-csv' || act === 'sor-add') {
    const items = sorFromCSV(rows);
    if (!items.length) return alert('No SOR rows found. Expected columns: Service No, Short Text, Rate, Unit (and optionally Valid From, Valid To, Long Text, State).');
    if (!items.hasState) {
      // Each State has its own SOR: say which one this file is (blank = applies everywhere)
      const st = prompt(`Which State is ${file.name} the SOR for?\nLeave blank if these rates apply in every State.`,
        project.state || sorStates[0] || '');
      if (st === null) return;
      if (st.trim()) for (const it of items) it.state = st.trim();
    }
    let next;
    if (act === 'sor-csv') {
      if (!confirm(`Replace the SOR with ${items.length} rates from ${file.name}?`)) return;
      next = { source: file.name, items };
    } else {
      // Same Service No and validity period replaces; anything else is added
      const byKey = new Map(SOR.items.map(it => [sorKey(it), it]));
      const updated = items.filter(it => byKey.has(sorKey(it))).length;
      if (!confirm(`Add ${items.length - updated} new rates and update ${updated} from ${file.name}?`)) return;
      for (const it of items) byKey.set(sorKey(it), it);
      next = { source: `${SOR.source} + ${file.name}`, items: [...byKey.values()] };
    }
    if (!store.set(KEY_SOR, next)) alert('The SOR is loaded for now, but this browser would not store it — it will need re-importing next time.');
    SOR = next;
  } else {
    const items = bisFromCSV(rows);
    if (!items.length) return alert('No BIS rows found. Expected columns: Designation (ISA…, ISMB…), kg/m, Group.');
    if (!confirm(`Replace the BIS table with ${items.length} sections from ${file.name}?`)) return;
    if (!store.set(KEY_BIS, { source: file.name, items })) alert('The BIS table is loaded for now, but this browser would not store it.');
    BIS = { source: file.name, items };
  }
  reloadData(true);
  toast(`Loaded ${file.name}`);
});
function reloadData(keepLoaded = false) {
  if (!keepLoaded) loadRefData();
  else indexRefData();
  refreshDataInfo();
  renderAll();
}
