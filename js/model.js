'use strict';

/* =====================================================================
   Project model
   ===================================================================== */
const DIMS = ['no', 'l', 'b', 'hd'];
let project = newProject();
let nextId = 1;

function newProject() {
  return { format: 'boq-project', version: 1, name: '', state: '', date: '', discount: '', lines: [] };
}
function newLine(init = {}) {
  return {
    id: nextId++, code: '', desc: '', no: '', l: '', b: '', hd: '', hdSection: '',
    poItem: '', asset: '', ref: null, ...init,
  };
}
const discountFrac = () => (evalExpr(project.discount).value || 0) / 100;

/* ---------- decimals by unit ----------
   Quantities are rounded to their unit's places before Amount is worked out,
   so every line reads Qty × Price = Amount as printed. Count units are kept
   to 3 places (a part LS stays 0.5) but show no trailing zeros. */
const UNIT_KIND = {
  count: ['EA', 'NO', 'NOS', 'NUMBER', 'EACH', 'LS', 'SET', 'SETS', 'PAIR', 'JOB'],
  linear: ['M', 'RM', 'RMT', 'MTR', 'KM', 'FT', 'RFT'],
  area: ['M2', 'SQM', 'SQ.M', 'FT2', 'SQFT', 'SQ.FT'],
  // everything else (M3, KG, TON, L, HR, …) gets 3 places
};
function unitFmt(unit) {
  const u = String(unit || '').trim().toUpperCase();
  if (UNIT_KIND.count.includes(u)) return { dp: 3, min: 0 };
  if (UNIT_KIND.linear.includes(u) || UNIT_KIND.area.includes(u)) return { dp: 2, min: 2 };
  return { dp: 3, min: 3 };
}
// Half away from zero; toPrecision clears float noise such as 1.0045 → 1.00449999…
function roundTo(v, dp) {
  const f = 10 ** dp;
  return Math.sign(v) * Math.round(Number((Math.abs(v) * f).toPrecision(15))) / f + 0;
}

function compute(line) {
  let qty = null, err = false;
  for (const d of DIMS) {
    const r = evalExpr(line[d]);
    if (r.error) err = true;
    else if (r.value !== null) qty = (qty === null ? 1 : qty) * r.value;
  }
  if (qty === null) qty = 0;
  const look = sorLookup(line.code);
  const sor = look?.entry || null;
  const info = look?.info || null;
  const uf = unitFmt(info?.unit ?? line.ref?.unit);
  qty = roundTo(qty, uf.dp);
  const price = sor ? roundTo(sor.rate * (1 - discountFrac()), 2) : 0;
  const amount = err ? 0 : roundTo(qty * price, 2);
  return { qty: err ? NaN : qty, err, look, sor, info, uf, price, amount };
}

function flagsFor(line, c) {
  const out = [];
  if (line.code && !c.look) out.push({ level: 'err', text: `Service No ${line.code} is not in the SOR.` });
  if (c.look && !c.sor) out.push({ level: 'err', text: `No SOR rate for ${line.code} ${rateContext()}. ` +
    `Rates exist for: ${c.look.entries.map(e => (e.state ? e.state + ', ' : '') + fmtPeriod(e)).join('; ')}.` });
  if (c.sor?.state && !project.state)
    out.push({ level: 'warn', text: `Rate taken from the ${c.sor.state} SOR — choose the project's State to be sure.` });
  if (c.err) out.push({ level: 'err', text: 'A dimension cannot be calculated — check No / L / B / H/D.' });
  const ref = line.ref;
  if (ref && c.info) {
    if (ref.short != null && ref.short.trim() !== c.info.short.trim())
      out.push({ level: 'warn', text: `Short Text changed. Template: “${ref.short}” · SOR: “${c.info.short}”` });
    if (ref.unit != null && ref.unit.trim().toUpperCase() !== c.info.unit.trim().toUpperCase())
      out.push({ level: 'warn', text: `Unit changed. Template: ${ref.unit} · SOR: ${c.info.unit}` });
  }
  if (ref && ref.qty != null && !c.err && roundTo(Number(ref.qty), c.uf.dp) !== c.qty)
    out.push({ level: 'warn', text: `Qty differs. Template: ${fmtQty(Number(ref.qty), c.uf)} · No×L×B×H/D: ${fmtQty(c.qty, c.uf)}` });
  return out;
}

/* =====================================================================
   Formatting
   ===================================================================== */
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfQ = {};
const qtyNf = uf => nfQ[uf.min + '/' + uf.dp] ||= new Intl.NumberFormat('en-IN', { minimumFractionDigits: uf.min, maximumFractionDigits: uf.dp });
const fmtMoney = v => nf2.format(v || 0);
const fmtQty = (v, uf = unitFmt('')) => isNaN(v) ? '#ERR' : qtyNf(uf).format(v || 0);
const fmtDim = v => String(Math.round(v * 1e6) / 1e6);
const fmtDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || ''); };
const fmtPeriod = e => e.from || e.to ? `${fmtDate(e.from) || '…'} to ${fmtDate(e.to) || '…'}` : 'no validity dates';
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
