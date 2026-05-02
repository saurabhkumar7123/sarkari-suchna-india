document.addEventListener("DOMContentLoaded", () => {

  fetch("/static/footer.html", { cache: "no-store" })
    .then(response => response.text())
    .then(data => {
      const foot = document.getElementById("footer");
      if (foot) {
        foot.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(data) : data;
      }

      const year = document.getElementById("year");
      if (year) year.textContent = new Date().getFullYear();
    })
    .catch(error => console.error("Footer load error:", error));

});