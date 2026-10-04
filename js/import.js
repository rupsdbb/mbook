/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Measurements from Excel: a blank sheet to paste into, and its import
   ===================================================================== */
// The blank sheet has the measurement sheet's columns in the same order, so a
// block copied from an MES sheet pastes straight in. Only these are read;
// the rest (greyed) come from the SOR and are ignored.
const XL_COLS = ['#', 'Service No', 'Short Text', 'Description', 'No', 'L', 'B', 'H/D', 'Qty', 'Unit', 'Price', 'Amount', 'PO Item', 'Asset'];
// Headings understood on import, written without spaces or punctuation
const XL_FIELDS = {
  code: ['SERVICENO', 'SERVICENUMBER', 'SERVICECODE', 'SERVICE', 'SAPCODE', 'CODE'],
  desc: ['DESCRIPTION', 'DETAILS', 'DETAIL', 'DESC'],
  no: ['NO', 'NOS', 'NUMBER', 'NUMBERS'],
  l: ['L', 'LENGTH'],
  b: ['B', 'BREADTH', 'WIDTH', 'W'],
  hd: ['HD', 'DH', 'H', 'D', 'DEPTH', 'HEIGHT'],
  hdSection: ['HDSECTION'],
  poItem: ['POITEM', 'PO'],
  asset: ['ASSET'],
};
const XL_READ = new Set(['Service No', 'Description', 'No', 'L', 'B', 'H/D', 'PO Item', 'Asset']);
const xlKey = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function blankMeasurementXlsx() {
  const data = sheetXml({
    cols: [5, 11, 30, 40, 8, 8, 8, 9, 10, 6, 10, 12, 12, 18],
    rows: [XL_COLS.map(v => ({ v, s: XL_READ.has(v) ? XS.head : XS.headMuted }))],
    freeze: 1,
  });
  const help = [
    [{ v: 'MBook measurement sheet', s: XS.title }],
    null,
    [{ v: `1. Copy entries from your measurement sheet, with the columns in this order: ${XL_COLS.join(' · ')}.`, s: XS.wrap }],
    [{ v: '2. Paste them into the Measurements sheet from row 2. An ordinary paste is fine: MBook reads only the columns with dark headings ' +
      '(Service No, Description, No, L, B, H/D, PO Item, Asset). The greyed columns are ignored and may show errors.', s: XS.wrap }],
    [{ v: `3. Save this file, then in ${APP.name} click Import Excel… and choose it.`, s: XS.wrap }],
    null,
    [{ v: 'Good to know', s: XS.bold }],
    [{ v: '• Arithmetic in No, L, B and H/D, such as =2*(0.52+0.42), comes across as the expression; anything else (a reference to another cell, say) as its value.', s: XS.wrap }],
    [{ v: '• A BIS section name in H/D, such as ISA 50x50x6, is replaced by its weight in kg/m.', s: XS.wrap }],
    [{ v: '• Rows with nothing in Service No, Description, No, L, B or H/D are skipped.', s: XS.wrap }],
    [{ v: '• Any workbook with these headings can be imported, such as an MES sheet. Description may be headed Details, and H/D may be D/H.', s: XS.wrap }],
    null,
    // as text, not a table: a row here would itself be imported
    [{ v: 'Example entry: Service No 7006796 · Description Excavation for footing F1 · No 4 · L 1.8 · B 1.8 · H/D 1.5 · ' +
      'PO Item Civil · Asset Sales Building', s: XS.wrap }],
  ];
  return xlsxBlob([
    { name: 'Measurements', xml: data },
    { name: 'How to use', xml: sheetXml({ cols: [120], rows: help }) },
  ]);
}

/* ---------- reading .xlsx ---------- */
// The entries of a ZIP file: name → { method, start, size } and a reader
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not an Excel workbook (.xlsx)');
  const entries = new Map(), dec = new TextDecoder();
  let p = dv.getUint32(eocd + 16, true);
  for (let n = dv.getUint16(eocd + 10, true); n > 0; n--) {
    if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('the file is damaged');
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    entries.set(name.toLowerCase(), { method, start, size });
    p += 46 + nameLen + extra + comment;
  }
  return async name => {
    const e = entries.get(name.toLowerCase());
    if (!e) return null;
    const raw = u8.subarray(e.start, e.start + e.size);
    if (e.method === 0) return dec.decode(raw);
    if (e.method !== 8) throw new Error('the file uses an unsupported compression');
    if (!window.DecompressionStream) throw new Error('this browser is too old to read Excel files');
    return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
}
const xmlDoc = text => new DOMParser().parseFromString(text, 'application/xml');
const xmlAll = (node, tag) => [...node.getElementsByTagNameNS('*', tag)];
const xmlText = (node, tag) => xmlAll(node, tag)[0]?.textContent ?? null;
// "B12" → column 1 (zero-based)
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
// A path in a relationship, relative to the folder of the file that names it
function zipPath(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

// Every sheet as rows of cells { v: string | number, f: formula, err }
async function readXlsx(buf) {
  if (buf.byteLength < 22) throw new Error('not an Excel workbook (.xlsx)');
  const sig = new Uint8Array(buf, 0, 4);
  if (sig[0] === 0xD0 && sig[1] === 0xCF)
    throw new Error('it is an old-style .xls workbook or is password-protected. Open it in Excel and save it as .xlsx without a password');
  const get = await unzip(buf).catch(err => { throw err instanceof RangeError ? new Error('the file is damaged') : err; });
  const wbPath = 'xl/workbook.xml';
  const wbXml = await get(wbPath);
  if (!wbXml) throw new Error('not an Excel workbook (.xlsx)');
  const rels = new Map(xmlAll(xmlDoc(await get('xl/_rels/workbook.xml.rels') || '<r/>'), 'Relationship')
    .map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const shared = xmlAll(xmlDoc(await get('xl/sharedStrings.xml') || '<sst/>'), 'si')
    .map(si => xmlAll(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
  const sheets = [];
  for (const s of xmlAll(xmlDoc(wbXml), 'sheet')) {
    const rid = [...s.attributes].find(a => a.localName === 'id')?.value;
    const target = rels.get(rid);
    const xml = target && await get(zipPath(wbPath, target));
    if (!xml) continue;
    const rows = [];
    let rn = 0;
    for (const r of xmlAll(xmlDoc(xml), 'row')) {
      rn = Number(r.getAttribute('r')) || rn + 1;
      const row = [];
      let cn = -1;
      for (const c of xmlAll(r, 'c')) {
        const ref = c.getAttribute('r');
        cn = ref ? colIndex(ref) : cn + 1;
        const t = c.getAttribute('t'), v = xmlText(c, 'v'), f = xmlText(c, 'f');
        let val = null, err = false;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = xmlAll(c, 't').map(x => x.textContent).join('');
        else if (t === 'str') val = v ?? '';
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'e') { val = v ?? '#ERROR'; err = true; }
        else if (v !== null && v !== '') val = Number(v);
        if (val !== null || f) row[cn] = { v: val, f, err };
      }
      rows[rn - 1] = row;
    }
    sheets.push({ name: s.getAttribute('name'), rows });
  }
  return sheets;
}
function csvSheets(text, name) {
  return [{ name, rows: parseCSV(text).map(r => r.map(v => ({ v, f: null, err: false }))) }];
}

/* ---------- from cells to entries ---------- */
// The heading row: the first of a sheet's opening rows that names a Service No
// column. Each field takes its leftmost matching column.
function findTable(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cols = {};
    (rows[i] || []).forEach((c, ci) => {
      const k = xlKey(c?.v);
      for (const [field, names] of Object.entries(XL_FIELDS))
        if (cols[field] === undefined && names.includes(k)) cols[field] = ci;
    });
    const dims = ['no', 'l', 'b', 'hd'].filter(f => cols[f] !== undefined).length;
    if (cols.code !== undefined && (dims || cols.desc !== undefined)) return { head: i, cols, score: dims * 2 + Object.keys(cols).length };
  }
  return null;
}
// 107.45399999999999 → "107.454"; never exponent notation
function numText(n) {
  if (!isFinite(n)) return '';
  const s = String(Number(n.toPrecision(12)));
  return /e/i.test(s) ? Number(n.toPrecision(12)).toFixed(12).replace(/\.?0+$/, '') : s;
}
const cellText = c => c == null || c.v == null ? '' : typeof c.v === 'number' ? numText(c.v) : String(c.v).trim();
// A dimension: plain arithmetic formulas stay expressions (when MBook works
// them out to Excel's own result); other formulas give their value
function dimText(c) {
  if (!c) return '';
  if (c.f && !c.err) {
    const e = c.f.replace(/^=/, '').replace(/\bPI\(\)/gi, 'pi').replace(/\bSQRT\(/gi, 'sqrt(').trim();
    if (/^[\d.+\-*/^()\s]+$/.test(e.replace(/sqrt|pi/g, ''))) {
      const r = evalExpr(e), want = typeof c.v === 'number' ? c.v : null;
      if (!r.error && r.value !== null && (want === null || Math.abs(r.value - want) <= 1e-9 * Math.max(1, Math.abs(want)))) return normDim(e);
    }
    // A formula saved without its result (by a program that doesn't calculate)
    // is kept as written, so the entry is flagged rather than left blank
    if (c.v == null || c.v === '') return '=' + c.f.replace(/^=/, '');
  }
  // a CSV keeps formulas as text: "=2*(0.52+0.42)"
  return normDim(cellText(c).replace(/^=(?=[\d.(+\-]|sqrt|pi)/i, ''));
}
function linesFromTable(rows, { head, cols }) {
  const lines = [];
  let skipped = 0, last = head;
  const at = (row, f) => cols[f] === undefined ? null : row[cols[f]];
  for (let i = head + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const line = {
      code: cellText(at(row, 'code')), desc: cellText(at(row, 'desc')),
      no: dimText(at(row, 'no')), l: dimText(at(row, 'l')), b: dimText(at(row, 'b')), hd: dimText(at(row, 'hd')),
      hdSection: cellText(at(row, 'hdSection')), poItem: cellText(at(row, 'poItem')), asset: cellText(at(row, 'asset')),
    };
    if (!line.code && !line.desc && !DIMS.some(d => line[d])) {
      // Rows of leftover formulas don't count, only a PO Item or Asset alone
      if (line.poItem || line.asset) skipped++;
      continue;
    }
    // A section name in H/D becomes its kg/m, as when typed in the sheet
    if (/^is/i.test(line.hd) && evalExpr(line.hd).error) {
      const sec = BIS.items.find(it => it.key === normSection(line.hd));
      if (sec) { line.hd = String(sec.kgm); line.hdSection = sec.name; }
    }
    if (line.hdSection && !isPlainNumber(line.hd)) line.hdSection = '';
    lines.push(line);
    last = i;
  }
  return { lines, skipped, first: head + 2, last: last + 1 };
}

/* ---------- dialog ---------- */
let xlBook = null; // { file, sheets: [{ name, rows, table }] }
$('btnImportXl').onclick = () => {
  xlBook = null;
  $('xlFile').textContent = 'No file chosen';
  $('xlForm').hidden = true;
  $('xlNote').textContent = '';
  $('xlOk').disabled = true;
  $('xlWhere').value = currentId != null ? 'after' : 'end';
  $('xlPo').value = $('xlAsset').value = '';
  $('dlgXl').returnValue = '';
  $('dlgXl').showModal();
};
$('xlBlank').onclick = () => {
  downloadBlob('MBook measurements.xlsx', blankMeasurementXlsx());
  toast('Downloaded MBook measurements.xlsx');
};
$('xlChoose').onclick = async () => {
  const file = await pickFile('.xlsx,.xlsm,.csv');
  if (!file) return;
  xlBook = null;
  $('xlOk').disabled = true;
  $('xlForm').hidden = true;
  $('xlFile').textContent = file.name;
  $('xlNote').textContent = 'Reading…';
  try {
    const sheets = /\.csv$/i.test(file.name)
      ? csvSheets(await readText(file), file.name)
      : await readXlsx(await file.arrayBuffer());
    const found = sheets.map(s => ({ ...s, table: findTable(s.rows) })).filter(s => s.table);
    if (!found.length) throw new Error('no sheet has a Service No heading with No, L, B, H/D or Description beside it. ' +
      'Paste the measurements into the blank sheet from this dialog');
    // The sheet with the most measurement columns comes first
    found.sort((a, b) => b.table.score - a.table.score);
    xlBook = { file: file.name, sheets: found };
    $('xlSheet').innerHTML = found.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
    $('xlSheet').hidden = $('xlSheetLabel').hidden = found.length < 2;
    $('xlForm').hidden = false;
    xlSummary();
  } catch (err) {
    $('xlNote').textContent = `Could not read ${file.name}: ${err.message}.`;
  }
};
$('xlSheet').onchange = xlSummary;
function xlSummary() {
  const s = xlBook.sheets[Number($('xlSheet').value) || 0];
  const r = linesFromTable(s.rows, s.table);
  s.result = r;
  const n = r.lines.length;
  const unknown = new Set(r.lines.filter(l => l.code && !sorMap.has(l.code)).map(l => l.code)).size;
  const missing = ['desc', 'no', 'l', 'b', 'hd', 'poItem', 'asset'].filter(f => s.table.cols[f] === undefined)
    .map(f => ({ desc: 'Description', no: 'No', l: 'L', b: 'B', hd: 'H/D', poItem: 'PO Item', asset: 'Asset' }[f]));
  $('xlNote').textContent = !n ? `No entries below the headings in row ${s.table.head + 1} of ${s.name}.`
    : `${n} ${n === 1 ? 'entry' : 'entries'} in ${s.name}, rows ${r.first}–${r.last}.` +
      (r.skipped ? ` ${r.skipped} row${r.skipped > 1 ? 's' : ''} with only a PO Item or Asset skipped.` : '') +
      (missing.length ? ` No ${missing.join(', ')} column.` : '') +
      (unknown ? ` ${unknown} service no${unknown > 1 ? 's are' : ' is'} not in the SOR.` : '') +
      ' Short Text, Unit and Price come from the SOR.';
  $('xlOk').disabled = !n;
}
$('dlgXl').addEventListener('close', () => {
  if ($('dlgXl').returnValue !== 'ok' || !xlBook) { xlBook = null; return; }
  const s = xlBook.sheets[Number($('xlSheet').value) || 0];
  const po = $('xlPo').value.trim(), asset = $('xlAsset').value.trim();
  const lines = s.result.lines.map(l => newLine({ ...l, poItem: l.poItem || po, asset: l.asset || asset }));
  const idx = currentId != null ? indexOfId(currentId) : -1;
  const at = $('xlWhere').value === 'after' && idx >= 0 ? idx + 1 : project.lines.length;
  addRows(at, lines);
  xlBook = null;
  const ids = new Set(lines.map(l => l.id));
  const flagged = lines.filter(l => flagsFor(l, compute(l)).length).length;
  toast(`Imported ${lines.length} ${lines.length === 1 ? 'entry' : 'entries'} from ${s.name}` +
    (flagged ? ` · ${flagged} ${flagged > 1 ? 'entries need' : 'entry needs'} review` : ''), {
    text: 'Undo', run: () => {
      project.lines = project.lines.filter(l => !ids.has(l.id));
      ids.forEach(id => checked.delete(id));
      if (ids.has(currentId)) currentId = null;
      changed(true);
      toast('Import undone');
    },
  });
  rowEl(lines[0]?.id)?.scrollIntoView({ block: 'center' });
});
