/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Misc
   ===================================================================== */
let toastTimer;
function toast(msg, action) {
  const t = $('toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.text;
    b.onclick = () => { t.classList.remove('show'); action.run(); };
    t.append(' ', b);
  }
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 8000 : 2600);
}
window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); autosave(); } });
window.addEventListener('beforeunload', e => {
  if (saveTimer) { clearTimeout(saveTimer); autosave(); }
  if (dirty && project.lines.length) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- name, version, GitHub link ---------- */
$('appName').textContent = APP.name;
$('appVer').textContent = 'v' + APP.version;
document.title = `${APP.name} — ${APP.tagline}`;
$('ghLink').href = APP.url;
$('ghLink').title = `${APP_ID}${window.BUILD ? ` (built ${fmtDate(window.BUILD.date)})` : ''} · ${APP.url.replace(/^https?:\/\//, '')}`;
$('ghLink').setAttribute('aria-label', `${APP.name} on GitHub`);
// Shown only when js/app.js holds a real address (the published copy has a placeholder)
const authorEmail = [].concat(APP.email || []).join('@').replace(/@+/g, '@');
if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authorEmail)) {
  $('mailLink').onclick = e => {
    e.preventDefault();
    location.href = `mailto:${authorEmail}?subject=${encodeURIComponent(APP_ID)}`;
  };
} else {
  $('mailLink').hidden = true;
}

/* ---------- release notes: click the version ---------- */
// **bold** and `code` in the notes; everything else is plain text
const noteHtml = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
$('appVer').onclick = () => {
  const notes = window.CHANGELOG || [];
  $('changesHead').textContent = `What's in ${APP.name} ${APP.version}`;
  $('changesBody').innerHTML = notes.map(r =>
    `<h3>${esc(r.version)}${r.title ? ' — ' + esc(r.title) : ''}</h3>` +
    `<p class="rel-date">${esc(fmtDate(r.date))}</p>` +
    `<ul>${r.items.map(i => `<li>${noteHtml(i)}</li>`).join('')}</ul>`).join('') || '<p>No release notes.</p>';
  $('changesLink').href = APP.url + '/blob/main/CHANGELOG.md';
  $('dlgChanges').showModal();
};

/* ---------- start ---------- */
setAskBeforeDelete(askBeforeDelete);
const repPrefs = store.get('boq.report');
if (repPrefs) { $('repGroup').value = repPrefs.g ?? 'asset'; $('repHideZero').checked = !!repPrefs.z; $('repDetail').checked = !!repPrefs.d; }
loadRefData();
// Drawings open from the folder the SOR names (the shared SOR points to its
// online drawings), unless the user has chosen one under Data ▸ Drawings folder
drawingCfg = store.get(KEY_DRG) || { ...drawingCfg, folder: SOR.drawings || drawingCfg.folder };
refreshDataInfo();
const saved = store.get(KEY_PROJECT);
if (saved) { try { loadProject(saved); } catch { renderAll(); } } else renderAll();
try { if (localStorage.getItem('boq.view') === 'report') setView('report'); } catch {}
if (!SOR.items.length) toast('No SOR loaded. Use Data ▸ Replace SOR from CSV.');
else if (SOR === window.SAMPLE_SOR) toast('Using the sample SOR (made-up rates). Load yours with Data ▸ Replace SOR from CSV.');
