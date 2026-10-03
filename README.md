# MBook

**BOQ Measurement** — a measurement book and BOQ tool in a single web page,
built to replace an Excel (`.xlsm`) measurement workbook. Open `index.html` in
Chrome or Edge — no install, no internet, no libraries.

Made by [rupsdbb](https://github.com/rupsdbb) — the GitHub icon at the bottom
right of the app links here. (A mail icon appears beside it if you put a real
address in `email` in `js/app.js`.) The version is shown next to the
name in the app; see [CHANGELOG.md](CHANGELOG.md).

## Files

| Path | What it is |
|---|---|
| `index.html` | The app (page layout) |
| `css/app.css`, `js/*.js` | Styles and code; `js/app.js` holds the name and version |
| `data/sor.sample.js` | A small made-up Schedule of Rates so the app works out of the box |
| `data/sor.js` | *Your* SOR — not in the repository (see below) |
| `data/bis.js` | Steel section weights (kg/m) from the BIS tables |
| `templates/sample-foundation.boqt` | Sample BOQ template |
| `drawings/` | Drawing files opened from the SOR long text (two samples included) |
| `tools/extract_data.py` | Builds `data/sor.js` and `data/bis.js` from a workbook's `SOR` and `BIS` sheets |
| `tools/build.py` | Builds `dist/MBook.html`, one self-contained file to share, and `dist/MBook-<version>.zip` with the drawings |

## Sharing a single file

`python3 tools/build.py` joins everything into `dist/MBook.html` — one file
that works offline with a double-click — plus a zip that also carries the
`drawings/` folder. Your own `data/sor.js` is built in when present, so `dist/`
is kept out of git.

## Releases

The version lives in `js/app.js` and is shown in the header (and in the
GitHub icon's tooltip, bottom right),
written into saved `.boq` / `.boqt` files (`"app": "MBook 1.0.0"`) and printed
on every PDF, Excel and HTML export, so any file shows which version made it.
For a release: bump `version` in `js/app.js`, add a section to
`CHANGELOG.md`, and tag the commit (`git tag v1.0.1`).

## Your own data

Rates, bills and site templates are work data, so `.gitignore` keeps them out
of the repository: workbooks, `*.boq` projects, CSV files, `data/sor.js`,
templates other than `sample-*`, and drawings other than the samples.

To use your Schedule of Rates, either

- run `python3 tools/extract_data.py "your workbook.xlsm"` once (needs
  `pip install openpyxl`; reads the `SOR` and `BIS` sheets) to create
  `data/sor.js`, which the app then loads instead of the sample, or
- in the app, use **Data ▸ Replace SOR from CSV…** (kept in that browser).

## Using it

- **Service No** — type a code, or words from the short text (`flange 50`) and
  press Enter to pick from matching SOR items.
- **No / L / B / H/D** — numbers or arithmetic: `+ - * / ^ ( )`, `sqrt(…)`
  and `pi` (`2*(1.1+1)`, `8+4+12+4`, `sqrt(3^2+4^2)`, `pi*0.6^2`). Usual
  order of operations, so `-2^2` is −4 (Excel would say 4; exports allow for it).
  Blank cells are skipped in the product, as Excel's `PRODUCT` does.
  Cells holding a formula show a blue corner; click to see it.
- **H/D** — type `IS…` (`ISA 65`, `ISMB 200`) and press Enter to pick a steel
  section; its kg/m goes into H/D and the section name is kept under it.
- **Hover a Service No** — a card shows Short Text, Unit, every rate period on
  file (the one in use is marked) and the start of the scope of work. Click the
  card for the full long text. **Ctrl+I** or ⓘ does the same for the current line.
- **State** — each State publishes its own SOR. When the SOR has rates tagged
  with a State, a **State** box appears; lines then use that State's rate,
  falling back to rates not tied to any State. With no State chosen, the
  untagged rates are used and a line priced from a State's rate is flagged.
- **Rates as on** — the date whose SOR rates are used. Each line takes the rate
  whose Valid From – Valid To covers that date; lines with no such rate are
  flagged and priced at nothing. Leave it blank to use the newest rate.
- **Drawing numbers** in the long text ("as per std drg no STD.DRG.101") are
  links. They open `drawings/<number>.pdf` next to this page, with `/` in the
  number written as `-` (so `ABC/XY/02` → `drawings/ABC-XY-02.pdf`).
  **Data ▸ Drawings folder…** points them somewhere else (a relative folder,
  `D:\Drawings`, or a web address) or changes the extension.
- **Esc** in a search popup puts back what the cell held before.
- **Enter / ↑ / ↓** move between rows; Enter on the last row adds one.
- **Decimals by unit** — EA, NO, LS, SET: whole numbers show no decimals
  (a part quantity like 0.5 LS is kept). M, RM, KM and areas (M2, SQM): 2
  places. M3, KG, TON and anything else: 3 places.
- **Price** = SOR rate × (1 − Discount %), rounded to 2 places.
  **Amount** = Qty × Price, using Qty already rounded to its unit's places, so
  every line reads Qty × Price = Amount as printed. In the Report, each item's
  Amount is its total Qty × Price.
- Work autosaves in the browser. Use **Save** for a `.boq` file you can keep,
  back up or move to another PC.

## Deleting rows

**Delete** (button or the Delete key, with a row clicked or checked) removes the
checked rows, or the current row. The confirmation has a **Don't ask again**
box; **Data ▸ Ask before deleting rows** turns it back on. Every delete shows
an **Undo** button, and **Ctrl+Z** (when not typing in a cell) restores the
last deletes, up to 20, until the page is closed or reloaded.

**Clear sheet** deletes every row after a confirmation; it can be undone the
same way. Project name, rate date and discount stay.

## Export

**Export…** writes the measurement sheet and/or the report (choose the
grouping) as:

- **PDF** — A4 landscape, headings repeated on every page, page numbers.
- **Excel (.xlsx)** — a *Measurement* and a *Report* sheet with live formulas:
  Qty `=ROUND(PRODUCT(E:H), places)`, Amount `=ROUND(Qty*Price,2)`, totals
  `=SUM(…)`, and arithmetic typed in No/L/B/H/D kept as formulas
  (`=SQRT(3^2+4^2)`, `=PI()`).
- **HTML page** — a plain, script-free page for sharing or printing.

## Report

The **Report** tab consolidates the sheet: each Service No's quantity summed
under each Asset, PO Item, PO Item › Asset or Asset › PO Item, with subtotals
and a grand total — or one abstract of all lines with no grouping. Lines with a
blank Asset / PO Item are grouped as `(blank)`. Options: hide items that net to
zero (e.g. fully deducted), and show the measurement lines behind each item.
**Print** prints just the report; **Export CSV** opens in Excel.

## Updating SOR / BIS

**Data ▸ Replace SOR from CSV…** — save the SOR sheet as CSV from Excel. Columns
(matched by header, otherwise in this order): Service No, Short Text, Rate,
Unit, Valid From, Valid To, Long Text, State. If the file has no State column,
you are asked which State it is for (blank = every State). Dates may be `2025-02-03`, `03.02.2025`,
`03-02-2025` or `03/02/2025` (day first).

**Data ▸ Add SOR rates from CSV…** keeps the current SOR and adds another
period's or another State's rates beside it (e.g. last year's SOR, or the
Bihar SOR), so old or present rates, and each State's rates, can be picked
with **Rates as on** and **State**. A row with the same Service No, validity
period and State as an existing one replaces it.

`tools/extract_data.py` reads an optional State column (H) in the `SOR` sheet;
`--state "Bihar"` tags every rate that has none.

**Replace BIS from CSV…** works the same with Designation, kg/m, Group.
**Restore built-in** goes back to `data/sor.js` (or the sample) and `data/bis.js`.

## Template file (`.boqt`)

JSON, one per standard drawing / part of work:

```json
{
  "format": "boq-template",
  "version": 1,
  "name": "Sample foundation",
  "lines": [
    { "serviceNo": "9900003", "shortText": "FOUNDN . RCC 1:1.5:3 MIX",
      "description": "Footings", "no": "4", "l": "1.2", "b": "1.2", "hd": "0.45",
      "unit": "M3", "qty": 2.592 }
  ]
}
```

`no`, `l`, `b`, `hd` may be numbers or expressions; `hdSection` (optional)
names a BIS section. On import the app asks for PO Item and Asset, takes Short
Text / Unit / Price from the current SOR, and recomputes Qty — lines where the
template's `shortText`, `unit` or `qty` disagree are flagged for review.
**Export template…** writes checked rows (or all rows) in this format.
