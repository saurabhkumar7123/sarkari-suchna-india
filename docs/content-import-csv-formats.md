# Content import CSV formats

Admin path: `/admin/csv-upload` → queue → generator `?importId=`.

Imported text is stored in `content_imports.content` and loaded into generator `#data` unchanged. **Publish/rendering uses the existing `[Section: …]` parser** (`generator/builders/sectionBuilder.js`). No change to CSS, templates, or published HTML.

Save spreadsheets as **CSV UTF-8** (Excel: *Save As → CSV UTF-8*).

---

## Format 1 — Legacy (unchanged)

One column, one draft per row. Full page in a single cell.

| Column   | Required | Description                          |
|----------|----------|--------------------------------------|
| `content`| Yes      | Full canonical text with `[Section: …]` blocks |

Example:

```csv
content
"[Section: ImportantDates]
Notification Date: 31 December 2025

[Section: ImportantLinks]
Apply Online=https://example.com"
```

**Behavior:** Non-empty `content` on a row → that row becomes **one** queue item; text is stored **as-is**.

---

## Format 2 — Structured (new, import-time compile)

Columns:

| Column         | Required | Description |
|----------------|----------|-------------|
| `import_group` | No       | Same value = one draft. Blank = continue previous group. First structured row defaults to group `1`. |
| `section`      | No*      | Section title for `[Section: Name]`. Blank = continue previous section. *Required before first `line` in a group. |
| `line`         | Yes**    | One parser line (`Key: value`, `Label=url`, FAQ `Q:`/`A:`, table CSV row, etc.). **Blank line = row skipped. |

Optional alias: `group` instead of `import_group`.

**Compiled storage** (same as manual generator input):

```text
[Section: ImportantDates]
Notification Date: 31 December 2025
Last Date: 30 January 2026

[Section: ImportantLinks]
Apply Online=https://example.com
```

Sample file: [`samples/content-import-structured-template.csv`](../samples/content-import-structured-template.csv)

### Carry-forward example

```csv
import_group,section,line
1,ImportantDates,Notification Date: 31 December 2025
,,"Last Date: 30 January 2026"
,ImportantLinks,Apply Online=https://example.com
```

Row 2: empty group → still group `1`; empty section → still `ImportantDates`.

---

## Mixed file

Rows with non-empty `content` use **legacy** (immediate draft). Other rows use structured compile. Pending structured group is flushed before each legacy row.

---

## Parser line syntax (unchanged)

Written in `line` or inside legacy `content`:

| Pattern              | Renders as        |
|----------------------|-------------------|
| `Label: value`       | Key-value row     |
| `Label=https://…`    | Link button       |
| `Q: …` / `A: …`      | FAQ accordion     |
| Comma-separated rows | Table (when valid)|
| `[Section: AnyName]` | Dynamic section   |

Avoid `:` and `=` on the same line when possible (parser warning).

---

## Validation & limits

| Rule | Default |
|------|---------|
| Max CSV rows | 200 (`CONTENT_IMPORT_MAX_ROWS`) |
| Max compiled/stored chars per draft | 500000 (`CONTENT_IMPORT_MAX_CONTENT_CHARS`) |
| File type | `.csv` only |
| Line without section (no prior `section` in group) | Rejected (400) |
| Empty `line` | Skipped (counts toward `skipped` in API response) |

---

## Rollback

Disable structured compile only (legacy `content` column still works):

```env
CONTENT_IMPORT_STRUCTURED=0
```

Disable entire import queue:

```env
CONTENT_IMPORT_ENABLED=0
```

---

## Implementation notes (developers)

- **Compiler:** `server/utils/contentCompiler.js` — import-time only.
- **Orchestration:** `server/services/contentImport.service.js` → `rowsToImportRecords()`.
- **Normalization:** `server/utils/normalizeSectionFormatting.js` after compile.
- **Do not modify** `sectionBuilder.js` for CSV features.
- **DB:** Still one `content` TEXT per row in `content_imports`; no schema migration.

Existing DB rows and old CSV uploads are unaffected.
