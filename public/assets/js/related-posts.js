document.addEventListener("DOMContentLoaded", async function(){

try{

let slug = window.location.pathname.split("/").pop();
slug = slug.replace(".html","");

console.log("Slug:", slug);

const res = await fetch(`/api/related/${slug}`);
const posts = await res.json();

console.log("Posts:", posts);

if(!posts.length) return;

 let html = `
<div class="related-section">

<div class="related-header">
<h2>Related Jobs</h2>
</div>

<div class="related-grid">
`;

 posts.forEach((p) => {
  const slug = p && p.slug != null ? String(p.slug).trim() : "";
  const href =
    slug && slug !== "undefined" && slug !== "null"
      ? `/${encodeURIComponent(slug).replace(/%2F/g, "/")}`
      : "#";
  if (href === "#") {
    console.error("Related post missing or invalid slug", p);
  }
  html += `
<div class="related-card">
<a href="${href}">
${p.title || ""}
</a>
</div>
`;
});

html += `
</ul>
</div>
</div>
`;

const box = document.getElementById("related-posts");

if (box) {
  box.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
}

}catch(e){

console.error("Related posts error:",e);

}

});