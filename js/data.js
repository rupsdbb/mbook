'use strict';

/* =====================================================================
   Storage helpers (localStorage may be unavailable — never fatal)
   ===================================================================== */
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  has(k) { try { return localStorage.getItem(k) !== null; } catch { return false; } },
};
const KEY_PROJECT = 'boq.project.v1';
const KEY_SOR = 'boq.sor.v1';
const KEY_BIS = 'boq.bis.v1';
const KEY_DRG = 'boq.drawings.v1';

/* =====================================================================
   Reference data: SOR and BIS
   ===================================================================== */
let SOR = { source: '', items: [] }, sorMap = new Map();
let BIS = { source: '', items: [] };

function loadRefData() {
  SOR = store.get(KEY_SOR) || window.DEFAULT_SOR || window.SAMPLE_SOR || { source: '(none)', items: [] };
  BIS = store.get(KEY_BIS) || window.DEFAULT_BIS || { source: '(none)', items: [] };
  indexRefData();
}
// A Service No can have several SOR rates, each with its own validity period
// (old and present SOR loaded together) and, optionally, its own State (each
// State publishes its own SOR). sorMap: code -> entries, newest Valid From
// first; sorStates: the States named in the SOR.
let sorStates = [];
// SAP long texts escape characters as <(>&<)> — show them as plain "&".
const unSap = t => String(t ?? '').replace(/<\(>(.*?)<\)>/g, '$1');
function indexRefData() {
  sorMap = new Map();
  const states = new Map();
  for (const it of SOR.items) {
    it.state = String(it.state ?? '').trim();
    if (it.state) states.set(it.state.toUpperCase(), it.state);
    it.short = unSap(it.short);
    it.long = unSap(it.long);
    const k = String(it.code);
    if (!sorMap.has(k)) sorMap.set(k, []);
    sorMap.get(k).push(it);
  }
  for (const list of sorMap.values()) list.sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  sorStates = [...states.values()].sort((a, b) => a.localeCompare(b));
  BIS.items.forEach(it => { it.key = normSection(it.name); });
  pickCache = null;
}
const inPeriod = (e, d) => (!e.from || e.from <= d) && (!e.to || d <= e.to);
const sameState = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
// A rate tagged with a State applies only there; an untagged rate applies
// everywhere. With no project State chosen, every rate is a candidate.
const fitsState = e => !e.state || !project.state || sameState(e.state, project.state);
// The SOR entry that prices a code: among the rates for the project's State,
// the one valid on the rate date (or the newest when no date is set). A rate
// named for the project's State wins over an untagged one; with no State
// chosen, untagged rates come first. `info` describes the item even when no
// rate applies.
function sorLookup(code) {
  const entries = code ? sorMap.get(String(code)) : null;
  if (!entries) return null;
  const cands = entries.filter(fitsState);
  const valid = project.date ? cands.filter(e => inPeriod(e, project.date)) : cands;
  const entry = (project.state ? valid.find(e => sameState(e.state, project.state)) : valid.find(e => !e.state))
    || valid[0] || null;
  return { entries, entry, info: entry || cands[0] || entries[0] };
}
// "for Bihar valid on 15-01-2025", for messages about missing rates
function rateContext() {
  return [project.state ? `for ${project.state}` : '', project.date ? `valid on ${fmtDate(project.date)}` : '']
    .filter(Boolean).join(' ') || 'in the SOR';
}
let pickCache = null;
// One row per Service No for the search popup, showing the rate in effect.
function pickItems() {
  if (!pickCache) pickCache = [...sorMap.values()].map(es => {
    const look = sorLookup(es[0].code);
    return { ...look.info, valid: !!look.entry };
  });
  return pickCache;
}
const normSection = s => String(s).toUpperCase().replace(/\s+/g, '');

/* =====================================================================
   Arithmetic in dimension cells: 8+4+12+4, 2*(1.1+1), sqrt(2), 0.3^2*pi
   ===================================================================== */
// Dimension cells take arithmetic: + - * / ^ ( ), sqrt(…) and pi, with the
// usual order (brackets, powers, × ÷, + −; so -2^2 is -4). The text is parsed
// into a tree so the same formula can also be written out for Excel.
const exprCache = new Map();
function evalExpr(raw) {
  const key = String(raw ?? '');
  let r = exprCache.get(key);
  if (!r) {
    r = parseExpr(key);
    if (exprCache.size > 5000) exprCache.clear();
    exprCache.set(key, r);
  }
  return r;
}
function parseExpr(raw) {
  let s = raw.trim();
  if (s.startsWith('=')) s = s.slice(1);
  if (s === '') return { value: null, ast: null };
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const fail = () => { throw 0; };
  const close = () => { ws(); if (s[i] !== ')') fail(); i++; };
  function primary() {
    ws();
    if (s[i] === '(') { i++; const e = sum(); close(); return { t: '()', e }; }
    let m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (m) { i += m[0].length; return { t: 'n', v: parseFloat(m[0]) }; }
    m = /^[a-z]+/i.exec(s.slice(i));
    if (!m) fail();
    i += m[0].length;
    const name = m[0].toLowerCase();
    ws();
    if (name === 'pi') {
      if (s[i] === '(') { i++; close(); }
      return { t: 'pi' };
    }
    if (name === 'sqrt' && s[i] === '(') { i++; const e = sum(); close(); return { t: 'sqrt', e }; }
    fail();
  }
  function power() {
    const base = primary();
    ws();
    if (s[i] === '^') { i++; return { t: '^', a: base, b: unary() }; } // right-assoc, 2^-1 allowed
    return base;
  }
  function unary() {
    ws();
    if (s[i] === '-') { i++; return { t: 'neg', e: unary() }; }
    if (s[i] === '+') { i++; return unary(); }
    return power();
  }
  function product() {
    let v = unary();
    for (;;) {
      ws();
      const c = s[i];
      if (c === '*' || c === 'x' || c === 'X' || c === '×') { i++; v = { t: '*', a: v, b: unary() }; }
      else if (c === '/' || c === '÷') { i++; v = { t: '/', a: v, b: unary() }; }
      else return v;
    }
  }
  function sum() {
    let v = product();
    for (;;) {
      ws();
      if (s[i] === '+') { i++; v = { t: '+', a: v, b: product() }; }
      else if (s[i] === '-') { i++; v = { t: '-', a: v, b: product() }; }
      else return v;
    }
  }
  try {
    const ast = sum(); ws();
    if (i !== s.length) return { value: null, error: true };
    const v = evalAst(ast);
    if (!isFinite(v)) return { value: null, error: true };
    return { value: v, ast };
  } catch { return { value: null, error: true }; }
}
function evalAst(n) {
  switch (n.t) {
    case 'n': return n.v;
    case 'pi': return Math.PI;
    case '()': return evalAst(n.e);
    case 'neg': return -evalAst(n.e);
    case 'sqrt': return Math.sqrt(evalAst(n.e));
    case '^': return evalAst(n.a) ** evalAst(n.b);
    case '*': return evalAst(n.a) * evalAst(n.b);
    case '/': return evalAst(n.a) / evalAst(n.b);
    case '+': return evalAst(n.a) + evalAst(n.b);
    case '-': return evalAst(n.a) - evalAst(n.b);
  }
}
// Excel formula text for a parsed cell. Excel applies unary minus before ^
// (=-2^2 is 4), so a negated power is bracketed to keep the same result.
function excelFormula(n) {
  switch (n.t) {
    case 'n': return String(n.v);
    case 'pi': return 'PI()';
    case '()': return `(${excelFormula(n.e)})`;
    case 'neg': return n.e.t === '^' ? `-(${excelFormula(n.e)})` : `-${excelFormula(n.e)}`;
    case 'sqrt': return `SQRT(${excelFormula(n.e)})`;
    // Excel reads 2^3^2 left to right; ours is right to left like maths
    case '^': return excelFormula(n.a) + '^' + (n.b.t === '^' ? `(${excelFormula(n.b)})` : excelFormula(n.b));
    default: return excelFormula(n.a) + n.t + excelFormula(n.b);
  }
}
const isPlainNumber = raw => /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(String(raw ?? ''));
