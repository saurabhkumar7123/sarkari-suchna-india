function safeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "#") return "#";
  const colonIdx = s.indexOf(":");
  if (colonIdx !== -1) {
    const proto = s.slice(0, colonIdx).toLowerCase();
    if (proto === "javascript" || proto === "data" || proto === "vbscript" || proto === "file") return "#";
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
      return u.href;
    } catch {
      return "#";
    }
  }
  if (s.startsWith("//")) return "#";
  if (s.startsWith("/")) return s;
  return "#";
}

async function loadNotifications() {
  const box = document.getElementById("pdfList");
  if (!box) return;

  try {
    const res = await fetch("/api/public/notifications", { cache: "no-store" });
    if (!res.ok) {
      box.innerHTML = "<p>Could not load notifications right now.</p>";
      return;
    }
    const body = await res.json();
    const files = (body && body.data) || [];

    if (!files.length) {
      box.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔔</div>
          <h3>No notifications available</h3>
          <p>New updates will appear here once uploaded.</p>
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    files.forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "notify-card";

      const lowerName = String(item.name || "").toLowerCase();
      const isImportant = /important|priority|notice/i.test(lowerName);
      const isUrgent = /urgent|emergency|immediate/i.test(lowerName);
      const isNew = item.date ? (Date.now() - new Date(item.date).getTime()) < 1000 * 60 * 60 * 24 * 3 : false;
      if (isUrgent) wrap.classList.add("urgent");
      else if (isImportant) wrap.classList.add("important");

      const top = document.createElement("div");
      top.className = "notify-top";

      const textWrap = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "notify-title";
      title.textContent = item.name || "PDF Notification";

      const date = document.createElement("p");
      date.className = "notify-date";
      date.textContent = item.date
        ? new Date(item.date).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        : "Date unavailable";

      textWrap.appendChild(title);
      textWrap.appendChild(date);

      const badges = document.createElement("div");
      badges.className = "notify-badges";
      if (isNew) badges.innerHTML += `<span class="badge new">NEW</span>`;
      if (isImportant) badges.innerHTML += `<span class="badge important">IMPORTANT</span>`;
      if (isUrgent) badges.innerHTML += `<span class="badge urgent">URGENT</span>`;

      top.appendChild(textWrap);
      if (badges.innerHTML.trim()) top.appendChild(badges);

      const summary = document.createElement("p");
      summary.className = "notify-summary";
      summary.textContent = "Official update available. Open to preview details or download notification PDF.";

      const actions = document.createElement("div");
      actions.className = "notify-actions";
      const linkUrl = safeUrl(String(item.absoluteUrl || item.url || "").trim() || "#");

      const viewLink = document.createElement("a");
      viewLink.href = linkUrl;
      viewLink.target = "_blank";
      viewLink.rel = "noopener noreferrer";
      viewLink.className = "action-link view";
      viewLink.textContent = "View";

      const dlLink = document.createElement("a");
      dlLink.href = linkUrl;
      dlLink.target = "_blank";
      dlLink.rel = "noopener noreferrer";
      dlLink.className = "action-link download";
      dlLink.textContent = "Download";
      dlLink.setAttribute("download", item.name || "notification.pdf");

      actions.appendChild(viewLink);
      actions.appendChild(dlLink);

      wrap.appendChild(top);
      wrap.appendChild(summary);
      wrap.appendChild(actions);
      frag.appendChild(wrap);
    });

    box.innerHTML = "";
    box.appendChild(frag);
  } catch (e) {
    console.error(e);
    box.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Error loading notifications</h3>
        <p>Please try again after refreshing the page.</p>
      </div>
    `;
  }
}

loadNotifications();
