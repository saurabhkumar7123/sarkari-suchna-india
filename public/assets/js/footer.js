document.addEventListener("DOMContentLoaded", () => {
  const foot = document.getElementById("footer");
  if (!foot) return;

  const setYear = () => {
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  };

  if (foot.innerHTML.trim()) {
    setYear();
    return;
  }

  fetch("/static/footer.html", { cache: "no-store" })
    .then((response) => response.text())
    .then((data) => {
      foot.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(data) : data;
      setYear();
    })
    .catch((error) => console.error("Footer load error:", error));
});
