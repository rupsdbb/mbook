<div align="center">

# MBook

**Measurement book and Bill of Quantities in a single web page**

Record site measurements, price them against your Schedule of Rates,
and turn them into a BOQ — offline, in the browser, with nothing to install.

[![License: GPL-3.0-or-later](https://img.shields.io/github/license/rupsdbb/mbook?color=blue)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/rupsdbb/mbook?label=version&color=informational)](CHANGELOG.md)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)
![Works offline](https://img.shields.io/badge/works-offline-success)
![Chrome | Edge](https://img.shields.io/badge/browser-Chrome%20%7C%20Edge-lightgrey)

[Features](#features) ·
[Quick start](#quick-start) ·
[Using MBook](#using-mbook) ·
[Your own SOR](#using-your-own-sor) ·
[File formats](#file-formats) ·
[Developers](#for-developers) ·
[License](#license)

</div>

---

## Overview

MBook replaces the Excel workbooks used to record site measurements and price
them against a **Schedule of Rates (SOR)**. Enter dimensions line by line, and
MBook looks up each item's description, unit and rate, works out quantities and
amounts, consolidates them into a BOQ, and exports the result to **PDF**,
**Excel** or **HTML**.

Everything runs in your browser — no installation, no server, no internet
connection and no third-party libraries. Your data never leaves your computer.

## Features

| Feature | What it does |
|---|---|
| **Measurement sheet** | No × L × B × H/D for every line, with arithmetic in any cell — `2*(1.1+1)`, `sqrt(3^2+4^2)`, `pi*0.6^2` |
| **SOR lookup** | Type a service code or search descriptions by keyword. Hover a code for its rate and full scope of work |
| **Rates by date and State** | Keep several SOR periods and State SORs side by side; each line takes the rate valid for the chosen date and State |
| **Steel weights** | Type a section such as `ISA 65` and pick its kg/m from the BIS tables |
| **Rounding by unit** | Whole numbers for EA / NO / LS, 2 decimals for lengths and areas, 3 for volumes and weights; amounts to 2 |
| **Templates** | Save and reuse standard BOQs; lines that no longer match the SOR are flagged for review |
| **Reports** | Quantities consolidated by Asset and/or PO Item, with subtotals and a grand total |
| **Export** | PDF, Excel with live formulas, and plain HTML |
| **Drawings** | Drawing numbers in the SOR text open the matching drawing file |
| **Safe by default** | Autosave in the browser, project files you can save and open, undo for deleted rows |

## Quick start

1. **Download** — click **Code ▸ Download ZIP** above and unzip it.
2. **Open** — double-click `index.html`; it opens in Chrome or Edge.
3. **Try it** — MBook starts with a small sample SOR of made-up rates.
   Click **+ Row**, type `excavation` under *Service No* and press <kbd>Enter</kbd>,
   or use **Import template…** to load `templates/sample-foundation.boqt`.

When you're ready, [load your own SOR](#using-your-own-sor).

## Using MBook

### The measurement sheet

| Column | What to enter |
|---|---|
| **Service No** | An SOR code, or words from its description, then <kbd>Enter</kbd> to pick from the matches |
| **Description** | Where or what was measured |
| **No, L, B, H/D** | Numbers or arithmetic; blank cells are skipped. In H/D, type `IS…` to pick a steel section's weight |
| **PO Item, Asset** | Labels used to group the report |

*Short Text*, *Unit*, *Price* and *Amount* fill in automatically:

> **Price** = SOR rate × (1 − Discount %) &nbsp;·&nbsp; **Amount** = Qty × Price

### Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Enter</kbd> / <kbd>↑</kbd> / <kbd>↓</kbd> | Move between rows (<kbd>Enter</kbd> on the last row adds one) |
| <kbd>Tab</kbd> | Next cell; from *Asset* it goes to the next row's *Service No*, adding a row at the end |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Copy the cell above into this one, as in Excel (a Service No brings its description, unit and rate) |
| <kbd>Esc</kbd> | Cancel a search and restore the cell |
| <kbd>Ctrl</kbd> + <kbd>I</kbd> | Show the full SOR text for the current line |
| <kbd>Delete</kbd> | Delete the selected row(s) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Bring back deleted rows |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Save the project |

### Rates as on, and State

- **Rates as on** — for each item, the rate whose validity period covers this
  date is used. Leave it blank to use the rate valid today; if your SOR has
  expired, the latest rate on file is used and the line is flagged so you can
  set the date of the work.
- **State** — appears once your SOR contains State-specific rates. Each line
  then uses that State's rate, falling back to rates that apply in every State.

Lines without a valid rate are flagged in red.

### Report

The **Report** tab totals each service code by Asset, by PO Item, or by both,
with subtotals and a grand total. It can hide items that net to zero and list
the measurement lines behind each total. Print it, or export it as CSV.

### Export

**Export…** saves the measurement sheet and/or the report as:

| Format | Details |
|---|---|
| **PDF** | A4 landscape with repeated headings and page numbers, ready to print |
| **Excel (.xlsx)** | Live formulas for quantities, amounts and totals |
| **HTML** | A plain page with no scripts, for sharing |

### Saving your work

Work is saved automatically in the browser you use. **Save** writes a `.boq`
project file you can back up, email or open on another computer.

## Using your own SOR

**From a CSV file** — in Excel, save your SOR sheet as CSV, then in MBook use
**Data ▸ Replace SOR from CSV…**. Use **Data ▸ Add SOR rates from CSV…** to add
another period or another State alongside the current rates.

**From an Excel workbook** — run the extractor once (requires `pip install openpyxl`):

```bash
python3 tools/extract_data.py "your workbook.xlsm" --state "State name"
```

It reads the `SOR` and `BIS` sheets and writes `data/sor.js`, which MBook then
loads instead of the sample. `--state` is optional.

<details>
<summary><b>CSV format</b></summary>

<br>

Columns are matched by heading, or taken in this order if there is no heading row:

| Service No | Short Text | Rate | Unit | Valid From | Valid To | Long Text | State |
|---|---|---|---|---|---|---|---|

- Only the first four columns are required.
- Dates may be `2025-04-01`, `01.04.2025`, `01-04-2025` or `01/04/2025` (day first).
- Leave *State* blank for rates that apply in every State. If the file has no
  *State* column, MBook asks which State it is for.

</details>

<details>
<summary><b>Drawings</b></summary>

<br>

Drawing numbers in the SOR text — for example *"as per std drg no STD.DRG.101"* —
open `drawings/<number>.pdf`, with `/` written as `-`
(`ABC/XY/02` opens `drawings/ABC-XY-02.pdf`).
**Data ▸ Drawings folder…** points to another folder, such as `D:\Drawings`,
or changes the file type.

</details>

## File formats

| Extension | Contents |
|---|---|
| `.boq` | A project — measurement lines plus project name, State, rate date and discount |
| `.boqt` | A template — a reusable set of lines. On import, MBook asks for the PO Item and Asset and takes descriptions, units and rates from the current SOR |

<details>
<summary><b>Template example</b></summary>

<br>

Both formats are plain JSON. A template line looks like:

```json
{ "serviceNo": "9900003", "shortText": "FOUNDN . RCC 1:1.5:3 MIX",
  "description": "Footings", "no": "4", "l": "1.2", "b": "1.2", "hd": "0.45",
  "unit": "M3", "qty": 2.592 }
```

</details>

## Privacy

MBook never sends anything anywhere. Your SOR, projects and settings stay on
your computer — in the browser's storage and in the files you save.

## For developers

```text
index.html     page layout
css/app.css    styles
js/            app code — js/app.js holds the name and version
data/          sample SOR and BIS steel tables
templates/     sample template
drawings/      sample drawings
tools/         extract_data.py (workbook → data/*.js) · build.py (single-file build)
```

- **Single-file build** — `python3 tools/build.py` bundles everything into
  `dist/MBook.html`, one file that opens with a double-click, plus a zip that
  includes `drawings/`.
- **Work data stays out of git** — `.gitignore` excludes workbooks, `.boq`
  projects, CSV files, `data/sor.js` and `dist/`.
- **Releasing** — bump `version` in `js/app.js`, add the release notes at the
  top of `js/changelog.js` (shown in the app when the version is clicked), run
  `tools/build.py` to regenerate [CHANGELOG.md](CHANGELOG.md), and tag the
  commit (`git tag v1.0.1`).

## License

Copyright © 2026 [rupsdbb](https://github.com/rupsdbb)

MBook is free software: you can redistribute it and/or modify it under the
terms of the **GNU General Public License** as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

MBook is distributed in the hope that it will be useful, but **without any
warranty**; without even the implied warranty of merchantability or fitness for
a particular purpose. See [LICENSE](LICENSE) for the full text.
