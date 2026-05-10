document.addEventListener("click", (e) => {
  const btn = e.target.closest("#results .page-btn[data-page]");
  if (!btn) return;
  e.preventDefault();
  const p = parseInt(btn.getAttribute("data-page") || "0", 10);
  if (p > 0) changePage(p);
});

/**
 * Phase 5: Search results no longer render the status badge.
 * Flip to `true` to instantly restore it without redeploy if a regression
 * is reported.
 */
const RENDER_BADGES_IN_SEARCH = false;

const params = new URLSearchParams(window.location.search);
const query = params.get("q");

const titleEl = document.getElementById("searchTitle");
const resultDiv = document.getElementById("results");
const resultCount = document.getElementById("resultCount");
const loader = document.getElementById("loader");

const resultsPerPage = 10;
let currentPage = 1;
let allResults = [];

if(!query){
  titleEl.innerText = "No Search Query";
} else {

  titleEl.innerText = `Search Results for "${query}"`;

  loader.style.display = "block";
  resultDiv.innerHTML = "";

 fetch(`/api/search?q=${encodeURIComponent(query)}`)
  .then(res => {
    if(!res.ok) throw new Error("API error");
    return res.json();
  })
  .then(data => {

    loader.style.display = "none";

    if(!Array.isArray(data)){
      resultDiv.innerHTML = "<p>Invalid response</p>";
      return;
    }

    resultCount.innerText = `${data.length} result(s) found`;

    if(data.length === 0){
      resultDiv.innerHTML = "<p>No results found</p>";
      return;
    }

    allResults = data;
    displayResults();

  })
  .catch(err => {
    loader.style.display = "none";
    resultDiv.innerHTML = "<p>Error loading results</p>";
    console.error(err);
  });
}


function displayResults(){

  const start = (currentPage - 1) * resultsPerPage;
  const end = start + resultsPerPage;

  const paginatedItems = allResults.slice(start, end);

  resultDiv.innerHTML = "";

  paginatedItems.forEach(item => {

    let preview = item.rawText
      ? item.rawText.substring(0, 200) + "..."
      : "";

    const esc = String(query || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = esc ? new RegExp(`(${esc})`, "gi") : null;

    if (regex) {
      preview = preview.replace(regex, `<span class="highlight">$1</span>`);
    }

    const titleStr = String(item.title || "");
    const highlightedTitle = regex ? titleStr.replace(regex, `<span class="highlight">$1</span>`) : titleStr;

    const rawUrl = item.url != null ? String(item.url).trim() : "";
    const safeUrl =
      rawUrl && rawUrl !== "undefined" && rawUrl !== "null" ? rawUrl : "#";
    if (safeUrl === "#") {
      console.error("Search result missing url", item);
    }
    const escHref = safeUrl
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");

    const badgeHtml = RENDER_BADGES_IN_SEARCH
      ? `<span class="badge ${getStatusClass(item.status)}">${item.status}</span>`
      : "";
    const chunk = `
      <div class="result-card">
        <h2><a href="${escHref}">${highlightedTitle}</a></h2>
        <p>${preview}</p>
       ${badgeHtml}
      </div>
    `;
    resultDiv.innerHTML += window.DOMPurify ? window.DOMPurify.sanitize(chunk) : chunk;
  });

  setupPagination();
}

function getStatusClass(status){

  if(!status) return "badge-default";

  status = status.toLowerCase();

  if(status.includes("new")) return "badge-green";
  if(status.includes("result")) return "badge-blue";
  if(status.includes("admit")) return "badge-orange";
  if(status.includes("answer")) return "badge-purple";
  if(status.includes("syllabus")) return "badge-teal";

  return "badge-default";
}


function setupPagination(){

  const pageCount = Math.ceil(allResults.length / resultsPerPage);

  let html = `<div class="pagination">`;

  for(let i=1; i<=pageCount; i++){

    html += `
      <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>
    `;
  }

  html += `</div>`;

  resultDiv.innerHTML += window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
}


function changePage(page){

  currentPage = page;

  displayResults();

}