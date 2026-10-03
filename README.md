# MBook

**A measurement book and Bill of Quantities (BOQ) tool that runs in a single web page.**

MBook replaces the Excel workbooks used to record site measurements and price
them against a Schedule of Rates (SOR). Enter dimensions line by line, and
MBook looks up each item's description, unit and rate, works out quantities
and amounts, consolidates them into a BOQ, and exports the result to PDF,
Excel or HTML.

It runs entirely in your browser: no installation, no server, no internet
connection, and no third-party libraries.

## Features

- **Measurement sheet** — No × L × B × H/D for each line, with arithmetic in
  any dimension (`2*(1.1+1)`, `sqrt(3^2+4^2)`, `pi*0.6^2`).
- **SOR lookup** — type a service code, or search the descriptions by keyword.
  Hover a code to see its rate and full scope of work; drawing numbers in the
  text open the matching drawing file.
- **Rates by date and State** — keep several SOR periods and State SORs side
  by side; each line takes the rate valid for the chosen date and State.
- **Steel weights** — type a section such as `ISA 65` and pick its kg/m from
  the BIS tables.
- **Sensible rounding** — quantities rounded by unit (whole numbers for EA/NO/LS,
  2 decimals for lengths and areas, 3 for volumes and weights); amounts to 2.
- **Templates** — save and reuse standard BOQs (e.g. a foundation or a
  building). Lines that no longer match the current SOR are flagged.
- **Reports** — each item's quantity consolidated by Asset and/or PO Item, with
  subtotals and a grand total.
- **Export** — PDF, Excel (with live formulas) and plain HTML.
- **Your work is safe** — autosave in the browser, save/open project files,
  undo for deleted rows.

## Getting started

1. Download the repository (**Code ▸ Download ZIP**) and unzip it.
2. Open `index.html` in Chrome or Edge.

MBook starts with a small **sample SOR** of made-up rates so you can try it
straight away. Click **+ Row**, type `excavation` in *Service No* and press
Enter, or use **Import template…** to load `templates/sample-foundation.boqt`.

To use your own rates, see [Using your own SOR](#using-your-own-sor).

## Using MBook

### The measurement sheet

| Column | What to enter |
|---|---|
| Service No | An SOR code, or words from its description, then Enter to pick from the matches |
| Description | Where or what was measured |
| No, L, B, H/D | Numbers or arithmetic; blank cells are skipped. In H/D, type `IS…` to pick a steel section's weight |
| PO Item, Asset | Labels used to group the report |

Short Text, Unit, Price and Amount fill in automatically.
**Price** = SOR rate × (1 − Discount %); **Amount** = Qty × Price.

Keyboard: **Enter / ↑ / ↓** move between rows (Enter on the last row adds one),
**Esc** cancels a search, **Ctrl+I** shows the full SOR text, **Delete** removes
the selected row and **Ctrl+Z** brings it back.

### Rates as on, and State

- **Rates as on** picks, for each item, the rate whose validity period covers
  that date. Leave it blank to use the newest rate.
- **State** appears once your SOR contains State-specific rates. Each line then
  uses that State's rate, falling back to rates that apply in every State.

Lines without a valid rate are flagged in red.

### Report

The **Report** tab totals each service code by Asset, by PO Item, or by both,
with subtotals and a grand total. It can hide items that net to zero and list
the measurement lines behind each total. Print it, or export it as CSV.

### Export

**Export…** saves the measurement sheet and/or the report as:

- **PDF** — A4 landscape, ready to print.
- **Excel (.xlsx)** — with live formulas for quantities, amounts and totals.
- **HTML** — a plain page with no scripts, for sharing.

### Saving your work

Work is saved automatically in the browser you use. **Save** writes a `.boq`
project file you can back up, email or open on another computer.

## Using your own SOR

Either:

- **From a CSV file** — in Excel, save your SOR sheet as CSV, then use
  **Data ▸ Replace SOR from CSV…** in MBook. **Data ▸ Add SOR rates from CSV…**
  adds another period or another State alongside the current rates.
- **From an Excel workbook** — run
  `python3 tools/extract_data.py "your workbook.xlsm" [--state "Name"]` (needs
  `pip install openpyxl`). It reads the `SOR` and `BIS` sheets and writes
  `data/sor.js`, which MBook then loads instead of the sample.

CSV columns, matched by heading (or taken in this order if there are none):

| Service No | Short Text | Rate | Unit | Valid From | Valid To | Long Text | State |
|---|---|---|---|---|---|---|---|

Only the first four are required. Dates can be `2025-04-01`, `01.04.2025`,
`01-04-2025` or `01/04/2025` (day first). Leave State blank for rates that
apply everywhere; if the file has no State column, MBook asks which State it
is for.

**Drawings:** drawing numbers in the SOR text open `drawings/<number>.pdf`,
with `/` written as `-` (so `ABC/XY/02` opens `drawings/ABC-XY-02.pdf`).
**Data ▸ Drawings folder…** points to another folder, such as `D:\Drawings`.

## File formats

- **`.boq`** — a project: the measurement lines plus project name, State, rate
  date and discount.
- **`.boqt`** — a template: a reusable set of lines. On import, MBook asks for
  the PO Item and Asset, and takes descriptions, units and rates from the
  current SOR.

Both are plain JSON. A template line looks like:

```json
{ "serviceNo": "9900003", "shortText": "FOUNDN . RCC 1:1.5:3 MIX",
  "description": "Footings", "no": "4", "l": "1.2", "b": "1.2", "hd": "0.45",
  "unit": "M3", "qty": 2.592 }
```

## Privacy

MBook never sends anything anywhere. Your SOR, projects and settings stay on
your computer, in the browser's storage and in the files you save.

## For developers

```
index.html          page layout
css/app.css         styles
js/                 app code (js/app.js holds the name and version)
data/               SOR sample, BIS steel tables
templates/          sample template
drawings/           sample drawings
tools/              extract_data.py (workbook → data/*.js), build.py (single-file build)
```

- `python3 tools/build.py` bundles everything into `dist/MBook.html`, one file
  that opens with a double-click, plus a zip that includes `drawings/`.
- `.gitignore` keeps work data out of the repository: workbooks, `.boq`
  projects, CSV files, `data/sor.js` and `dist/`.
- To release: bump `version` in `js/app.js`, add an entry to
  [CHANGELOG.md](CHANGELOG.md), and tag the commit (`git tag v1.0.1`).
