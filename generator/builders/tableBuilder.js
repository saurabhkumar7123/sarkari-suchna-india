  /* ===== SMART TABLE BUILDER (Rowspan + Colspan Rules) ===== */

const { parseTableContent } = require("../lib/csvGridParser");
const { renderTableCellContent } = require("../lib/tableCellLink");

function buildTable(raw) {
  const parsed = parseTableContent(raw);
  let rows = parsed.rows;

  if (!rows.length) {
    return "";
  }

  const rowCount = rows.length;
  const colCount = rows[0].length;

  // rowspan (-)
  for (let i = 1; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (rows[i][j] === "-") {
        rows[i][j] = rows[i - 1][j];
      }
    }
  }

  // colspan (=)
  for (let i = 0; i < rowCount; i++) {
    for (let j = 1; j < colCount; j++) {
      if (rows[i][j] === "=") {
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

      let rowspan = 1;
      let colspan = 1;

      for (let k = j + 1; k < colCount; k++) {
        if (rows[i][k] === rows[i][j]) {
          colspan++;
          skip[i][k] = true;
        } else break;
      }

      for (let k = i + 1; k < rowCount; k++) {
        let same = true;
        for (let c = 0; c < colspan; c++) {
          if (rows[k][j + c] !== rows[i][j + c]) {
            same = false;
            break;
          }
        }
        if (same) {
          rowspan++;
          for (let c = 0; c < colspan; c++) {
            skip[k][j + c] = true;
          }
        } else break;
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
