document.addEventListener("DOMContentLoaded", function () {

  fetch("/static/about-site.html", { cache: "no-store" })
    .then(response => response.text())
    .then(data => {
      document.getElementById("about-site").innerHTML = data;
    })
    .catch(error => console.error("About Section Load Error:", error));

});