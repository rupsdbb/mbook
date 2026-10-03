'use strict';

/* =====================================================================
   Report: each Service No consolidated under Asset / PO Item
   ===================================================================== */
const FIELD_LABEL = { asset: 'Asset', poItem: 'PO Item' };
let view = 'sheet';

function setView(v) {
  view = v;
  document.body.classList.toggle('view-report', v === 'report');
  $('main').hidden = v === 'report';
  $('report').hidden = v !== 'report';
  $('tabSheet').classList.toggle('active', v === 'sheet');
  $('tabReport').classList.toggle('active', v === 'report');
  $('tabSheet').setAttribute('aria-selected', v === 'sheet');
  $('tabReport').setAttribute('aria-selected', v === 'report');
  hideCard();
  if (v === 'report') renderReport();
  try { localStorage.setItem('boq.view', v); } catch {}
}
$('tabSheet').onclick = () => setView('sheet');
$('tabReport').onclick = () => setView('report');

// Tree of groups (one level per grouping field) whose leaves are Service Nos
// with their quantities summed, in order of first appearance.
function buildReport(levels) {
  const root = { kids: new Map(), items: new Map(), amount: 0 };
  project.lines.forEach((l, idx) => {
    if (!l.code) return;
    const c = compute(l);
    const path = [root];
    for (const f of levels) {
      const node = path[path.length - 1];
      const k = (l[f] || '').trim() || '(blank)';
      if (!node.kids.has(k)) node.kids.set(k, { name: k, field: f, kids: new Map(), items: new Map(), amount: 0 });
      path.push(node.kids.get(k));
    }
    const leaf = path[path.length - 1];
    let it = leaf.items.get(l.code);
    if (!it) leaf.items.set(l.code, it = { code: l.code, info: c.info, look: c.look, sor: c.sor, uf: c.uf, price: c.price, qty: 0, amount: 0, err: false, lines: [] });
    if (c.err) it.err = true; else it.qty += c.qty;
    it.lines.push({ n: idx + 1, desc: l.desc, qty: c.qty });
  });
  // Each consolidated item reads Qty × Price = Amount; groups add up their items
  (function total(node) {
    node.amount = 0;
    for (const it of node.items.values()) {
      it.qty = roundTo(it.qty, it.uf.dp);
      it.amount = it.sor && !it.err ? roundTo(it.qty * it.price, 2) : 0;
      node.amount += it.amount;
    }
    for (const kid of node.kids.values()) node.amount += total(kid);
    node.amount = roundTo(node.amount, 2);
    return node.amount;
  })(root);
  return root;
}
const isZero = it => !it.err && it.qty === 0;
function visibleItems(node, hideZero) { return [...node.items.values()].filter(it => !(hideZero && isZero(it))); }
function hasVisible(node, hideZero) {
  return visibleItems(node, hideZero).length > 0 || [...node.kids.values()].some(k => hasVisible(k, hideZero));
}

const reportLevels = sel => sel.value ? sel.value.split('>') : [];
function renderReport() {
  const levels = reportLevels($('repGroup'));
  let html = `<thead><tr><th class="num">Sl</th><th>Service No</th><th>Short Text</th><th>Unit</th>` +
    `<th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>`;
  const red = t => `<span class="norate">${t}</span>`;
  for (const r of reportRows(levels, $('repHideZero').checked, $('repDetail').checked)) {
    if (r.type === 'group') {
      html += `<tr class="g g${r.depth}"><td colspan="7">${esc(r.label)}: ${esc(r.name)}</td></tr>`;
    } else if (r.type === 'item') {
      const it = r.it, t = itemText(it);
      html += `<tr><td class="num">${r.sl}</td><td>${esc(it.code)}</td>` +
        `<td>${it.info ? esc(t.short) : red('Not in SOR')}</td><td>${esc(t.unit)}</td>` +
        `<td class="num">${it.err ? red('#ERR') : t.qty}</td>` +
        `<td class="num">${t.price === '—' ? `<span class="norate" title="No SOR rate ${esc(rateContext())}">—</span>` : t.price}</td>` +
        `<td class="num">${t.amount}</td></tr>`;
    } else if (r.type === 'detail') {
      html += `<tr class="d"><td></td><td class="num">#${r.ln.n}</td><td class="dd" colspan="2">${esc(r.ln.desc)}</td>` +
        `<td class="num">${fmtQty(r.ln.qty, r.it.uf)}</td><td></td><td></td></tr>`;
    } else if (r.type === 'subtotal') {
      html += `<tr class="st st${r.depth}"><td colspan="6" class="num">Total ${esc(r.name)}</td><td class="num">${fmtMoney(r.amount)}</td></tr>`;
    } else {
      html += `<tr class="gt"><td colspan="6" class="num">Grand total</td><td class="num">${fmtMoney(r.amount)}</td></tr>`;
    }
  }
  html += '</tbody>';
  const any = project.lines.some(l => l.code);
  $('repTable').innerHTML = any ? html : '';
  $('repTable').hidden = !any;
  $('repEmpty').hidden = any;
  $('repTitle').innerHTML = `<h2>${esc(project.name || 'BOQ')}</h2>` +
    `Consolidated by ${esc(groupingName(levels))}${project.state ? ` · ${esc(project.state)}` : ''}` +
    ` · rates as on ${project.date ? esc(fmtDate(project.date)) : 'newest SOR'}` +
    (discountFrac() ? ` · discount ${esc(project.discount)}%` : '');
}
['repGroup', 'repHideZero', 'repDetail'].forEach(id => $(id).addEventListener('change', () => {
  renderReport();
  try { localStorage.setItem('boq.report', JSON.stringify({ g: $('repGroup').value, z: $('repHideZero').checked, d: $('repDetail').checked })); } catch {}
}));
$('repPrint').onclick = () => window.print();

$('repCsv').onclick = () => {
  const levels = reportLevels($('repGroup'));
  // Text starting with = + - @ would run as a formula in Excel; numbers are left alone
  const q = v => {
    if (typeof v === 'number') return String(v);
    let t = String(v);
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const rows = [[...levels.map(f => FIELD_LABEL[f]), 'Service No', 'Short Text', 'Unit', 'Qty', 'Price', 'Amount']];
  for (const r of reportRows(levels, $('repHideZero').checked, false)) {
    if (r.type !== 'item') continue;
    const it = r.it;
    rows.push([...r.path, it.code, it.info?.short || '', it.info?.unit || '', it.err ? '#ERR' : it.qty,
      it.sor ? it.price.toFixed(2) : '', it.sor ? it.amount.toFixed(2) : '']);
  }
  const by = levels.map(f => FIELD_LABEL[f].replace(' ', '')).join('-') || 'Abstract';
  download(`${safeName(project.name)} - ${by}.csv`, '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
};
