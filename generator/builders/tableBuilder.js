/* ===== SMART TABLE BUILDER (Rowspan + Colspan Rules) ===== */

const { parseTableContent } = require("../lib/csvGridParser");
const { renderTableCellContent } = require("../lib/tableCellLink");

function buildTable(raw) {
  const parsed = parseTableContent(raw);
  const rows = parsed.rows.map((row) => [...row]);

  if (!rows.length) {
    return "";
  }

  const rowCount = rows.length;
  const colCount = rows[0].length;

  const mergeUp = Array.from({ length: rowCount }, () => Array(colCount).fill(false));
  const mergeLeft = Array.from({ length: rowCount }, () => Array(colCount).fill(false));

  // rowspan (-) — explicit only; copies value from cell above
  for (let i = 1; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (rows[i][j] === "-") {
        mergeUp[i][j] = true;
        rows[i][j] = rows[i - 1][j];
      }
    }
  }

  // colspan (=) — explicit only; copies value from cell to the left
  for (let i = 0; i < rowCount; i++) {
    for (let j = 1; j < colCount; j++) {
      if (rows[i][j] === "=") {
        mergeLeft[i][j] = true;
        rows[i][j] = rows[i][j - 1];
      }
    }
  }

  // empty (*)
  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (rows[i][j] === "*") {
        rows[i][j] = "";
      }
    }
  }

  const skip = Array.from({ length: rowCount }, () => Array(colCount).fill(false));

  const isWideTable = colCount >= 5;
  const wrapClass = isWideTable ? "table-responsive table-responsive--wide" : "table-responsive";
  const tableClass = isWideTable ? "table table--wide" : "table";

  let html = `<div class="${wrapClass}"><table class="${tableClass}">`;

  for (let i = 0; i < rowCount; i++) {
    html += "<tr>";

    for (let j = 0; j < colCount; j++) {
      if (skip[i][j]) continue;

      let colspan = 1;
      while (j + colspan < colCount && mergeLeft[i][j + colspan]) {
        skip[i][j + colspan] = true;
        colspan++;
      }

      let rowspan = 1;
      while (i + rowspan < rowCount) {
        let canMerge = true;
        for (let c = 0; c < colspan; c++) {
          if (!mergeUp[i + rowspan][j + c]) {
            canMerge = false;
            break;
          }
        }
        if (!canMerge) break;
        for (let c = 0; c < colspan; c++) {
          skip[i + rowspan][j + c] = true;
        }
        rowspan++;
      }

      const tag = i === 0 ? "th" : "td";
      const cellMode = "title";
      html += `<${tag}
      ${rowspan > 1 ? `rowspan="${rowspan}"` : ""}
      ${colspan > 1 ? `colspan="${colspan}"` : ""}
      >
      ${renderTableCellContent(rows[i][j], { mode: cellMode })}
      </${tag}>`;
    }

    html += "</tr>";
  }

  html += "</table></div>";

  return html;
}

module.exports = { buildTable };
