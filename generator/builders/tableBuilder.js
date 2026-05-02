  /* ===== SMART TABLE BUILDER (Rowspan + Colspan Rules) ===== */

const { escapeHtml } = require("../../server/utils/escapeHtml");

function buildTable(raw){

  let rows = raw.split("\n").filter(Boolean)
  .map(r => r.split(",").map(c => c.trim()));

  const rowCount = rows.length;
  const colCount = rows[0].length;

  // rowspan (-)
  for(let i=1;i<rowCount;i++){
    for(let j=0;j<colCount;j++){
      if(rows[i][j] === "-"){
        rows[i][j] = rows[i-1][j];
      }
    }
  }

  // colspan (=)
  for(let i=0;i<rowCount;i++){
    for(let j=1;j<colCount;j++){
      if(rows[i][j] === "="){
        rows[i][j] = rows[i][j-1];
      }
    }
  }

  // empty (*)
  for(let i=0;i<rowCount;i++){
    for(let j=0;j<colCount;j++){
      if(rows[i][j] === "*"){
        rows[i][j] = "";
      }
    }
  }

  const skip = Array.from({length:rowCount},()=>Array(colCount).fill(false));

  let html=`<div class="table-responsive"><table class="table">`;

  for(let i=0;i<rowCount;i++){

    html+="<tr>";

    for(let j=0;j<colCount;j++){

      if(skip[i][j]) continue;

      let rowspan=1;
      let colspan=1;

      // horizontal merge
      for(let k=j+1;k<colCount;k++){
        if(rows[i][k]===rows[i][j]){
          colspan++;
          skip[i][k]=true;
        } else break;
      }

      // vertical merge
      for(let k=i+1;k<rowCount;k++){

        let same=true;

        for(let c=0;c<colspan;c++){
          if(rows[k][j+c]!==rows[i][j+c]){
            same=false;
            break;
          }
        }

        if(same){
          rowspan++;
          for(let c=0;c<colspan;c++){
            skip[k][j+c]=true;
          }
        } else break;
      }

      const tag=i===0?"th":"td";

      html+=`<${tag}
      ${rowspan>1?`rowspan="${rowspan}"`:""}
      ${colspan>1?`colspan="${colspan}"`:""}
      >
      ${escapeHtml(rows[i][j])}
      </${tag}>`;

    }

    html+="</tr>";
  }

  html+="</table></div>";

  return html;
}

module.exports = { buildTable };