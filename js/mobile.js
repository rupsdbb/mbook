/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';

/* =====================================================================
   Phone screens: a thin band at the top and bottom, with the header's
   controls in a menu that opens over the sheet
   ===================================================================== */
// Keep in step with the body.phone rules in css/app.css. A phone keeps this
// layout whichever way it is held: upright it is narrow, and sideways it is
// a touch screen too short for the full layout (tablets are taller, and
// computers have a mouse). A page not laid out yet (zero width, e.g. opened
// in the background) isn't taken for a phone.
const PHONE = matchMedia('(min-width: 1px) and (max-width: 760px), (pointer: coarse) and (min-height: 1px) and (max-height: 500px)');
// What moves into the menu, and where; each leaves a marker (kept for good)
// so it can go back, however often the phone is turned
const PHONE_MOVES = [
  ['fldProject', 'slotProject'], ['stateField', 'slotProject'], ['fldDate', 'slotProject'], ['fldDiscount', 'slotProject'],
  ['grpFile', 'slotFile'], ['grpTpl', 'slotTpl'], ['grpRows', 'slotRows'], ['menuWrap', 'slotData'],
  ['appVer', 'slotInfo'], ['stData', 'slotInfo'], ['stSaved', 'slotInfo'],
];
const phoneMarks = new Map();
function phoneLayout() {
  const phone = PHONE.matches;
  if (document.body.classList.contains('phone') === phone) return;
  // A field being typed in is finished first: moving it would drop the focus
  // without the change being saved
  const active = document.activeElement;
  if (active && PHONE_MOVES.some(([id]) => $(id).contains(active))) active.blur();
  if (!phone && $('dlgMenu').open) $('dlgMenu').close();
  for (const [id, slot] of PHONE_MOVES) {
    const el = $(id);
    if (phone) {
      if (!phoneMarks.has(id)) phoneMarks.set(id, el.parentNode.insertBefore(document.createComment(id), el));
      $(slot).append(el);
    } else {
      const mark = phoneMarks.get(id);
      if (mark) mark.parentNode.insertBefore(el, mark);
    }
  }
  // the About links stay last; the version reads as a link to the release notes
  if (phone) $('slotInfo').append($('mGh'));
  $('appVer').textContent = (phone ? "What's new in v" : 'v') + APP.version;
  document.body.classList.toggle('phone', phone);
}
// rotating or resizing; resize as well, as not every browser reports the change
PHONE.addEventListener('change', phoneLayout);
window.addEventListener('resize', phoneLayout);
phoneLayout();

$('mGh').href = APP.url;
$('mMenu').onclick = () => {
  $('menuData').classList.remove('open');
  $('dlgMenu').showModal();
  $('dlgMenu').querySelector('.msheet-body').scrollTop = 0;
};
$('mClose').onclick = () => $('dlgMenu').close();
$('mAdd').onclick = () => $('btnAdd').click();
// A command closes the menu once it has run (its own click handler comes
// first); the project fields stay open for typing. A tap outside closes too.
$('dlgMenu').addEventListener('click', e => {
  const dlg = $('dlgMenu');
  if (e.target === dlg) return dlg.close();
  const b = e.target.closest('button, a');
  if (b && b.id !== 'btnData' && !b.closest('#slotProject')) dlg.close();
});
// Hover doesn't exist on a touch screen: tapping the review count shows why
$('stFlagsWrap').addEventListener('click', () => {
  if (document.body.classList.contains('phone') && $('stFlagsWrap').title) toast($('stFlagsWrap').title);
});

/* ---------- entries in two lines ----------
   On a phone each entry shows Service No and Short Text on one line and
   No, L, B, H/D and Qty below (css/app.css). Tapping its number opens the
   rest: Description, PO Item, Asset, and the price worked out. */
let entryLine = null;
tbody.addEventListener('click', e => {
  if (!document.body.classList.contains('phone') || !e.target.closest('td.c-line')) return;
  const line = lineById(Number(e.target.closest('tr').dataset.id));
  if (!line) return;
  entryLine = line;
  const c = compute(line);
  $('entNo').textContent = indexOfId(line.id) + 1;
  $('entCode').textContent = [line.code, c.info?.short].filter(Boolean).join(' · ');
  $('entDesc').value = line.desc;
  $('entPo').value = line.poItem;
  $('entAsset').value = line.asset;
  $('entSum').textContent = c.err ? 'A dimension cannot be calculated.'
    : `Qty ${fmtQty(c.qty, c.uf)} ${c.info?.unit || ''}` +
      (c.sor ? ` × ${fmtMoney(c.price)} = ${fmtMoney(c.amount)}` : (line.code ? ' · no SOR rate' : ''));
  $('dlgEntry').returnValue = '';
  $('dlgEntry').showModal();
});
$('dlgEntry').addEventListener('close', () => {
  const line = entryLine;
  entryLine = null;
  if ($('dlgEntry').returnValue !== 'ok' || !line || !project.lines.includes(line)) return;
  line.desc = $('entDesc').value;
  line.poItem = $('entPo').value;
  line.asset = $('entAsset').value;
  refreshRow(line);
  changed();
  refreshLists();
});

/* ---------- upright only ----------
   On a phone MBook is used upright. Installed on Android it is locked so
   (manifest.webmanifest); in a browser, which can't be locked, a phone
   turned sideways gets a message over the page until it is turned back.
   Both the phone's orientation and the page's shape must say sideways: the
   on-screen keyboard can make the page wider than tall while the phone is
   upright, and a browser reporting a stale orientation mustn't hide the
   page from someone holding the phone upright. */
const isPhoneDevice = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 500;
function sideways() {
  const t = screen.orientation?.type;
  const turned = t ? t.startsWith('landscape') : Math.abs(window.orientation || 0) === 90; // older iPhones
  return turned && innerWidth > innerHeight;
}
function checkUpright() {
  const turn = isPhoneDevice() && sideways();
  // Typing can't go on unseen: the box being edited is finished (and saved),
  // which also puts the keyboard away
  if (turn && !document.body.classList.contains('turn')) document.activeElement?.blur?.();
  document.body.classList.toggle('turn', turn);
}
screen.orientation?.addEventListener('change', checkUpright);
window.addEventListener('orientationchange', checkUpright);
window.addEventListener('resize', checkUpright);
checkUpright();
// Opened as an installed app (or full screen), the lock itself can be asked for
if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)
  screen.orientation?.lock?.('portrait').catch(() => {});
