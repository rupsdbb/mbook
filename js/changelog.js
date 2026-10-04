/* MBook — Copyright (C) 2026 rupsdbb
   SPDX-License-Identifier: GPL-3.0-or-later */
// Release notes, newest first: shown when the version in the header is clicked,
// and written out as CHANGELOG.md by tools/build.py. Keep this a plain JSON
// array (double quotes, no trailing commas) so the build can read it.
// **bold** and `code` are understood.
window.CHANGELOG = [
  {
    "version": "1.0.0",
    "date": "2026-10-04",
    "title": "First release",
    "items": [
      "**Measurement sheet** — No × L × B × H/D for every entry, with arithmetic in any cell (`+ - * / ^ ( )`, `sqrt()`, `pi`).",
      "**Service No lookup** — type a code, or words from the description to search the SOR.",
      "**Hover card** — a code's rate, validity and scope of work; click for the full long text, with drawing numbers that open the drawing.",
      "**Rates by date and State** — several SOR periods and State SORs side by side; **Rates as on** and **State** pick the rate that applies.",
      "**Rate check** — with no rate date set, rates are checked against today; expired rates are flagged and explained.",
      "**Steel weights** — type `IS…` in H/D to pick a section's kg/m from the BIS tables.",
      "**Rounding by unit** — whole numbers for EA / NO / LS, 2 decimals for lengths and areas, 3 for volumes and weights; No, L, B and H/D are shown the same way. Price and Amount to 2.",
      "**Discount** — up to 2 decimals, applied to prices as it is typed.",
      "**Templates** (`.boqt`) — import and export standard BOQs; entries that differ from the SOR are flagged.",
      "**Report** — each Service No consolidated by Asset and/or PO Item, with subtotals and a grand total.",
      "**Export** — PDF, Excel with live formulas, and a plain HTML page.",
      "**Projects** (`.boq`) — save and open, autosave in the browser, undo for deleted rows.",
      "**Keyboard** — Enter and arrows move between rows; Tab from Asset goes to the next row's Service No, adding a row at the end; Ctrl+D copies the cell above, as in Excel.",
      "**Review** — entries needing attention are counted in the footer; hover the count to see why.",
      "**Single-file build** — `tools/build.py` makes one self-contained `MBook.html` to share."
    ]
  }
];
