# Changelog

Versions follow `major.minor.patch`: patch for fixes, minor for new features,
major for changes that break saved files.

## 1.0.0 — 2026-10-04

First release.

- Measurement sheet: Service No lookup by code or by searching the Short Text,
  No × L × B × H/D with arithmetic (`+ - * / ^ ( )`, `sqrt()`, `pi`), steel
  weights from the BIS tables by typing `IS…` in H/D.
- SOR with several rate periods and States per item; **Rates as on** and
  **State** pick the rate that applies. Hover card and long text with
  clickable drawing numbers.
- Quantities rounded by unit (count, linear/area, volume/weight); Price and
  Amount to 2 places.
- BOQ templates (`.boqt`) to import and export; lines that differ from the SOR
  are flagged for review.
- Report consolidating each Service No by Asset and/or PO Item.
- Export to PDF, Excel (.xlsx, with live formulas) and a plain HTML page.
- Save/Open projects (`.boq`), autosave in the browser, row delete with undo.
- `tools/build.py` makes one self-contained `MBook.html` to share.
