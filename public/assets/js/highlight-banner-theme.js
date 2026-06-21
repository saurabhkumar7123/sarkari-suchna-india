(function () {
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeStatusKey(value) {
    return cleanText(value).toLowerCase();
  }

  function isPlaceholderFactValue(value) {
    return /will\s+be\s+update(d)?(\s+here)?\s+soon|will\s+be\s+updated\s+soon|available\s+soon|to\s+be\s+announced|^tba$|^n\/a$|^-$|not\s+yet\s+(released|announced|available)|coming\s+soon/i.test(
      cleanText(value)
    );
  }

  function formatPostsWithCommas(value) {
    const raw = cleanText(value);
    if (!raw) return "";
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return raw;
    return Number(digits).toLocaleString("en-IN");
  }

  function bannerStatusBadge(status, title) {
    const s = normalizeStatusKey(status);
    const t = cleanText(title).toLowerCase();
    if (s.includes("admit") || /\badmit\s*card\b/.test(t)) return "Admit Card";
    if (s.includes("result") || /\bresult\b/.test(t)) return "Result Declared";
    if (s.includes("answer") || /\banswer\s*key\b/.test(t)) return "Answer Key";
    if (s.includes("syllabus") || /\bsyllabus\b/.test(t)) return "Syllabus";
    if (s.includes("admission") || /\badmission\b/.test(t)) return "Admission";
    if (
      s.includes("new form") ||
      s === "form" ||
      s === "new" ||
      /\bonline\s+form\b/.test(t) ||
      /\bapply\s+online\b/.test(t)
    ) {
      return "Apply Online";
    }
    if (s.includes("notification") || /\bnotification\b/.test(t)) return "Notification";
    return "Recruitment";
  }

  const ORG_RULES = [
    { re: /\b(upsssc)\b/i, label: "UPSSSC" },
    { re: /\b(staff selection commission|ssc)\b/i, label: "SSC" },
    { re: /\b(union public service commission|upsc)\b/i, label: "UPSC" },
    { re: /\b(railway recruitment board|rrb)\b/i, label: "RRB" },
    { re: /\b(uttar pradesh police|up police)\b/i, label: "UP Police" },
    { re: /\b(crpf)\b/i, label: "CRPF" },
    { re: /\b(indian air force|airforce|agniveer)\b/i, label: "Indian Air Force" },
    { re: /\b(indian army)\b/i, label: "Indian Army" },
    { re: /\b(ctet|tet)\b/i, label: "CTET" },
    { re: /\b(up tgt|up pgt|tgt|pgt)\b/i, label: "UP Education" },
    { re: /\b(high court)\b/i, label: "High Court" },
    { re: /\b(railway)\b/i, label: "Railway" }
  ];

  function bannerOrgName(title, categoryHint) {
    const haystack = `${title} ${categoryHint}`.toLowerCase();
    for (const rule of ORG_RULES) {
      if (rule.re.test(haystack)) return rule.label;
    }
    const cat = cleanText(categoryHint);
    if (cat && cat.toLowerCase() !== "general") {
      return cat
        .split(/[,\s]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }
    return "Official Notification";
  }

  function shortBannerTitle(title, postName) {
    let t = cleanText(title);
    if (!t) return cleanText(postName);
    t = t.replace(/\([\d,\s]+posts?\)/gi, "").trim();
    t = t.replace(
      /\b(online\s+form|apply\s+online|admit\s+card|answer\s+key|result\s+declared?|notification|dv\s*&\s*pst)\b/gi,
      ""
    );
    t = t.replace(/\s{2,}/g, " ").replace(/[-–,:]+\s*$/g, "").trim();
    const yearMatch = t.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : "";
    const post = cleanText(postName);
    if (t.length > 48 && post) {
      return cleanText(year && !post.includes(year) ? `${post} ${year}` : post);
    }
    return t || post;
  }

  function bannerActionLine(status, title) {
    const badge = bannerStatusBadge(status, title);
    if (badge === "Apply Online") return "Online Form Started";
    if (badge === "Admit Card") return "Hall Ticket Available";
    if (badge === "Result Declared") return "Check Result Now";
    if (badge === "Answer Key") return "Answer Key Released";
    if (badge === "Syllabus") return "Download Syllabus";
    if (badge === "Admission") return "Admission Update";
    if (badge === "Notification") return "Official Notification";
    return "Latest Update";
  }

  function themeClassFromText(title, categoryHint, statusHint) {
    const s = `${title} ${categoryHint} ${statusHint}`.toLowerCase();
    if (/\brailway\b/.test(s) || /\brrb\b/.test(s)) return "theme-railway";
    if (/\barmy\b/.test(s) || /\bdefence\b/.test(s) || /\bairforce\b/.test(s) || /\bagniveer\b/.test(s)) {
      return "theme-defence";
    }
    if (/\bpolice\b/.test(s) || /\bcrpf\b/.test(s)) return "theme-police";
    if (/\bssc\b/.test(s) || /\bupsc\b/.test(s)) return "theme-ssc";
    if (/\bctet\b/.test(s) || /\btet\b/.test(s) || /\btgt\b/.test(s) || /\bpgt\b/.test(s)) return "theme-teaching";
    if (/\bhigh court\b/.test(s) || /\bcourt\b/.test(s)) return "theme-court";
    if (/\bupsssc\b/.test(s) || /\buttar pradesh\b/.test(s) || /\bbihar\b/.test(s)) return "theme-state";
    return "";
  }

  function normalizeSectionKey(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findValueInRows(card, labelRe) {
    if (!card) return "";
    const rows = Array.from(card.querySelectorAll(".date-row"));
    const row = rows.find((r) => labelRe.test(cleanText(r.querySelector(".date-label")?.textContent || "")));
    return cleanText(row?.querySelector(".date-value")?.textContent || "");
  }

  function extractQualificationFromDom(byLabel) {
    const eligibilityCard = byLabel[normalizeSectionKey("eligibility")];
    if (!eligibilityCard) return "";
    const text = cleanText(eligibilityCard.querySelector(".card-content")?.textContent || "");
    const match = text.match(
      /(10th|12th|intermediate|diploma|graduation|graduate|degree|b\.?\s*e\.?|b\.?\s*tech|iti|post\s*graduate|master)/i
    );
    if (!match) return "";
    const idx = text.toLowerCase().indexOf(match[0].toLowerCase());
    return cleanText(text.slice(Math.max(0, idx - 12), Math.min(text.length, idx + 48)));
  }

  function extractBannerFactFromDom(byLabel) {
    const importantDatesCard = byLabel[normalizeSectionKey("important dates")];
    const lastDateRaw = findValueInRows(importantDatesCard, /(?:online\s+apply\s+)?last\s*date/i);
    if (lastDateRaw && !isPlaceholderFactValue(lastDateRaw)) return `Last Date: ${lastDateRaw}`;

    const examDateRaw = findValueInRows(importantDatesCard, /exam\s*date/i);
    if (examDateRaw && !isPlaceholderFactValue(examDateRaw)) return `Exam Date: ${examDateRaw}`;

    const qualification = extractQualificationFromDom(byLabel);
    if (qualification && !isPlaceholderFactValue(qualification)) {
      const q = qualification.length > 52 ? `${qualification.slice(0, 49)}…` : qualification;
      return `Qualification: ${q}`;
    }

    const feeCard = byLabel[normalizeSectionKey("application fee")];
    const fee = findValueInRows(feeCard, /fee|amount/i) || cleanText(feeCard?.querySelector(".card-content")?.textContent || "");
    if (fee && !isPlaceholderFactValue(fee)) return `Fees: ${fee}`;

    return "";
  }

  function readPostName(root) {
    const subtitle = root.querySelector(".highlight-banner-subtitle");
    if (!subtitle) return "";
    return cleanText(
      subtitle.textContent
        .replace(/^Post Name/i, "")
        .replace(/^:/, "")
        .trim()
    );
  }

  function inferStatusHint(root) {
    const metaTag = document.querySelector(".meta-tag");
    if (metaTag) return cleanText(metaTag.textContent);
    const oldTag = root.querySelector(".highlight-banner-tag");
    return cleanText(oldTag?.textContent);
  }

  function enhanceBanner(root) {
    if (!root || root.getAttribute("data-banner-enhanced") === "1") return;

    const titleEl = root.querySelector(".highlight-banner-title-main");
    const actionEl = root.querySelector(".highlight-banner-action");
    const subtitleEl = root.querySelector(".highlight-banner-subtitle");
    const statusBadgeEl = root.querySelector(".highlight-banner-status-badge") || root.querySelector(".highlight-banner-top-badge");
    const orgBadgeEl = root.querySelector(".highlight-banner-org-badge") || root.querySelector(".highlight-banner-top-badge-outline");
    const advtValueEl = root.querySelector(".highlight-banner-top-advt-value");
    const totalNumEl = root.querySelector(".highlight-banner-total-num");
    const tagEl = root.querySelector(".highlight-banner-tag");
    const brandTaglineEl = root.querySelector(".highlight-banner-brand-tagline");

    const fullTitle = cleanText(titleEl?.textContent || document.querySelector(".job-title")?.textContent);
    if (!fullTitle) return;

    const postName = readPostName(root) || fullTitle;
    const statusHint = inferStatusHint(root);
    const categoryHint = statusHint;

    const statusBadge = bannerStatusBadge(statusHint, fullTitle);
    const orgName = bannerOrgName(fullTitle, categoryHint);
    const titleShort = shortBannerTitle(fullTitle, postName);
    const actionLine = bannerActionLine(statusHint, fullTitle);

    if (statusBadgeEl) statusBadgeEl.textContent = statusBadge;
    if (orgBadgeEl) orgBadgeEl.textContent = orgName;

    if (advtValueEl) {
      const advt = cleanText(advtValueEl.textContent);
      if (!advt || advt === "-" || isPlaceholderFactValue(advt)) {
        advtValueEl.textContent = orgName;
      }
    }

    if (titleEl) titleEl.textContent = titleShort;
    if (actionEl) {
      actionEl.textContent = actionLine;
    } else if (subtitleEl) {
      const actionNode = document.createElement("p");
      actionNode.className = "highlight-banner-action";
      actionNode.textContent = actionLine;
      subtitleEl.insertAdjacentElement("beforebegin", actionNode);
    }

    if (subtitleEl) {
      const labelNode = subtitleEl.querySelector(".highlight-banner-subtitle-label");
      if (labelNode) labelNode.remove();
      if (!readPostName(root)) subtitleEl.textContent = postName;
    }

    if (totalNumEl) {
      const formatted = formatPostsWithCommas(totalNumEl.textContent);
      if (formatted) totalNumEl.textContent = formatted;
    }

    const cards = Array.from(document.querySelectorAll(".card"));
    const byLabel = {};
    cards.forEach((card) => {
      const titleNode = card.querySelector(".section-title");
      if (!titleNode) return;
      byLabel[normalizeSectionKey(cleanText(titleNode.textContent.replace("➜", "")))] = card;
    });

    const fact = extractBannerFactFromDom(byLabel);
    if (tagEl && fact) {
      tagEl.textContent = fact;
    }

    if (brandTaglineEl && /official sarkari suchna india/i.test(brandTaglineEl.textContent)) {
      brandTaglineEl.textContent = "Sarkari Suchna India — Latest Govt Jobs";
    }

    const themeClass = themeClassFromText(fullTitle, categoryHint, statusHint);
    if (themeClass) {
      root.classList.remove(
        "theme-railway",
        "theme-defence",
        "theme-police",
        "theme-ssc",
        "theme-teaching",
        "theme-court",
        "theme-state"
      );
      root.classList.add(themeClass);
    }

    root.setAttribute("data-banner-enhanced", "1");
  }

  function init() {
    const root = document.querySelector(".highlight-banner-root");
    if (!root) return;
    enhanceBanner(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
