/* Keep in sync with server: smartClean.js + sectionDetector.js + validateOutput.js + jobSectionStructure.js */
(function () {
  const ANNEXURE_LINE = /^\s*annexure[\s\-–:]*[ivx\d]*\s*$/i;
  const PAGE_PIPE = /page\s*\|\s*\d+|^\s*page\s+\d+\s*of\s+\d+\s*$/i;
  const RTI_OR_LEGAL =
    /\b(rti|right\s+to\s+information|tribunal|writ\s+petition|jurisdiction|legal\s+notice|disclaimer|undertaking|court\s+of)\b/i;
  const INSTRUCTION_APPLY =
    /\b(how\s+to\s+apply|steps\s+to\s+apply|procedure|applicant\s+must|candidates?\s+(are\s+)?(advised|required)|click\s+here|upload\s+(your|the)|scanned\s+photograph|password\s+for|print\s+out|login\s+to|fill\s+up\s+the|submit\s+online|image\s+size|photo\s*graph\s*size|passport\s+photo|dimensions?\s*\(|dpi\b|jpeg\s+only|pdf\s+only|document\s+upload\s+size|file\s+size|kb\b|mb\b)\b/i;
  const SYLLABUS_PATTERN = /^(syllabus|exam\s*pattern|marks\s*distribution|negative\s*marking|question\s*paper\s*structure)/i;

  const SYLLABUS_MARKS =
    /\b(syllabus|exam\s*pattern|marks\s*distribution|negative\s*marking|question\s*paper|paper\s+i{1,3}\b|duration\s+of\s+exam|total\s+marks|qualifying\s+marks)\b/i;
  const PAYMENT_RULES =
    /\b(refund\s+of\s+fee|fee\s+once\s+paid|fee\s+shall\s+not\s+be|payment\s+gateway\s+will|online\s+payment\s+only|challan\s+generation\s+rules)\b/i;
  const GENERAL_CONDITIONS =
    /\b(general\s+conditions|terms\s+and\s+conditions|violation|liable\s+for|deemed\s+to\s+be|without\s+prejudice|in\s+case\s+of\s+dispute)\b/i;
  const CERTIFICATE_RULES =
    /\b(certificate\s+(must|shall)|self\s*attested|dated\s+not\s+earlier|validity\s+of\s+certificate|issued\s+not\s+earlier|bona\s*fide)\b/i;
  const ELIGIBILITY_NOISE =
    /\b(nationality|marital\s*status|nri\s+quota| oci\b|persons\s+of\s+indian\s+origin)\b/i;
  const NOTES_DISCLAIMER = /\b(note\s*:|disclaimer|important\s*notice\s*:|candidates?\s+must\s+note)\b/i;

  function shouldDropLine(line) {
    const t = line.trim();
    if (!t) return false;
    if (ANNEXURE_LINE.test(t)) return true;
    if (PAGE_PIPE.test(t)) return true;
    if (RTI_OR_LEGAL.test(t)) return true;
    if (INSTRUCTION_APPLY.test(t)) return true;
    if (SYLLABUS_PATTERN.test(t) || SYLLABUS_MARKS.test(t)) return true;
    if (PAYMENT_RULES.test(t)) return true;
    if (GENERAL_CONDITIONS.test(t)) return true;
    if (CERTIFICATE_RULES.test(t)) return true;
    if (ELIGIBILITY_NOISE.test(t)) return true;
    if (NOTES_DISCLAIMER.test(t)) return true;
    if (/^\(?\s*see\s+annexure/i.test(t)) return true;
    if (t.length > 320) return true;
    if (
      t.length > 200 &&
      (t.match(/\./g) || []).length >= 4 &&
      !/\b(last\s*date|notification|vacancy|posts?|qualification|age\s*limit|exam\s*date)\b/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  function smartCleanJobText(text) {
    if (!text || typeof text !== "string") return "";
    const raw = text.replace(/\r\n/g, "\n").replace(/\{\{TEXT\}\}/gi, "").replace(/\$\{text\}/gi, "");
    const lines = raw.split("\n");
    const out = [];
    let annexSkip = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tr = line.trim();
      if (/^annexure\b/i.test(tr)) {
        annexSkip = true;
        continue;
      }
      if (annexSkip) {
        if (!tr) {
          annexSkip = false;
          continue;
        }
        if (tr.length > 80 && /\d{1,2}[./-]\d{1,2}/.test(tr)) {
          annexSkip = false;
          out.push(line);
        }
        continue;
      }
      if (shouldDropLine(line)) continue;
      out.push(line);
    }
    return out
      .join("\n")
      .replace(/[\t\f\v\u00a0]+/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+|\n+$/g, "")
      .trim();
  }

  const MAX_CLASSIFY_LINE = 280;

  function isNoiseLine(line) {
    const t = line.trim();
    if (!t || t.length < 2) return true;
    if (shouldDropLine(line)) return true;
    if (t.length > MAX_CLASSIFY_LINE && !/\d{1,2}[./-]\d{1,2}/.test(t) && !/https?:\/\//i.test(t)) return true;
    return false;
  }

  function isFeeLine(line) {
    const s = String(line || "").trim();
    const l = s.toLowerCase();
    if (/\b(application\s*)?fee(s)?\b|शुल्क|exam\s*fee|registration\s*fee/i.test(l)) return true;
    if (/(₹|rs\.?)\s*[\d,]+/i.test(s) && /\b(general|obc|ews|sc\b|st\b|ur\b|pwd|ph|female|male)\b/i.test(l)) {
      return true;
    }
    if (/\/-\s*$/.test(s) && /[\d,]+/.test(s) && /\b(for|general|obc|ews|sc|st)\b/i.test(l)) return true;
    return false;
  }

  function classifyLine(line) {
    const s = line.trim();
    const l = s.toLowerCase();
    if (/^\[\s*section\s*:/i.test(s)) return "other";
    if (/https?:\/\/|www\./i.test(s)) return "links";
    if (isFeeLine(s)) return "fee";
    if (/^(Q|Question)\s*[:：]/i.test(s) || /^(A|Answer)\s*[:：]/i.test(s)) return "faq";
    if (/^\s*state\s*[:/-]|^राज्य\s*[:：]/i.test(s)) return "state";
    if (
      /\b(domicile|निवास|residing\s+in|only\s+for\s+candidates\s+of)\b/i.test(l) &&
      line.length < 180 &&
      /\b(uttar\s*pradesh|madhya\s*pradesh|bihar|rajasthan|delhi|haryana|punjab|assam|west\s*bengal|odisha|jharkhand|gujarat|maharashtra|karnataka|tamil\s*nadu|telangana|andhra|kerala|goa|chhattisgarh|himachal|uttarakhand|all\s+india|pan\s+india|u\.?p\.?|m\.?p\.?)\b/i.test(
        l
      )
    ) {
      return "state";
    }
    if (
      /\b(written\s*test|typing\s*test|personal\s*interview|document\s*verification|skill\s*test|physical\s*test|medical\s*exam)\b/i.test(
        l
      )
    ) {
      return "selection";
    }
    if (
      /\b(last\s*date|closing\s*date|opening\s*date|notification\s*date|exam\s*date|start\s*date|apply\s*start|online\s*apply|application\s*begin)\b/i.test(
        l
      ) &&
      !isFeeLine(s)
    ) {
      return "dates";
    }
    if (/\bfee\s*payment\s*last\b/i.test(l)) return "dates";
    if (/\d{1,2}[\s./-]+\d{1,2}[\s./-]+\d{2,4}/.test(s)) return "dates";
    if (/\b(last|exam|date|notification|start|schedule)\b/i.test(l) && /\d/.test(s)) return "dates";
    if (/\b(age|years?|आयु|वर्ष|born)\b/i.test(l) && /\d/.test(s)) return "age";
    if (
      /\b(qualification|degree|graduation|certificate|diploma|b\.?e|b\.?tech|m\.?a|m\.?sc|12th|10th|phd|matric|intermediate)\b/i.test(l)
    ) {
      return "qualification";
    }
    if (
      !isFeeLine(s) &&
      ((/\b(vacancy|vacancies|vacant|posts?|category|total)\b/i.test(l) && /\d/.test(s)) ||
        /\b(vacancy|vacancies|posts?\s*per|post\s*[:-]|category\s*[:/-])\b/i.test(l) ||
        (/\b(recruitment|भर्ती)\b/i.test(l) &&
          /\b(posts?|vacancies|vacant|vacancy|पद|seats?)\b/i.test(l) &&
          /\d/.test(s)) ||
        (/\b(obc|sc\b|st\b|ews|ur\b|gen)\b/i.test(l) && /\b(post|vacancy|seat)\b/i.test(l) && /\d/.test(s)))
    ) {
      return "vacancy";
    }
    if (/\b(written|interview|\btest\b|phase\s*[ivx\d]|prelims|mains|objective|descriptive)\b/i.test(l)) {
      return "selection";
    }
    if (/\bexamination\b/i.test(l) && /\b(tier|phase|stage|written|computer\s*based|cbt)\b/i.test(l)) {
      return "selection";
    }
    if (
      /,/.test(s) &&
      s.split(",").length >= 2 &&
      s.length < 220 &&
      !isFeeLine(s) &&
      !/https?:\/\//i.test(s)
    ) {
      return "vacancy";
    }
    return "other";
  }

  function uniq(lines) {
    const seen = new Set();
    const out = [];
    for (const x of lines) {
      const k = x.toLowerCase().replace(/\s+/g, " ").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x.trim());
    }
    return out;
  }

  function splitInlineSectionHeaders(text) {
    let s = String(text || "")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!s) return "";
    s = s.replace(/,\s*\[Section:/gi, "\n[Section:");
    s = s.replace(/([^\n])\[Section:/gi, "$1\n[Section:");
    s = s.replace(/\]\s*\[Section:/gi, "]\n[Section:");
    return s;
  }

  function parseSectionsFromText(text) {
    const src = String(text || "");
    const sectionRegex = /\[\s*section\s*:\s*(.*?)\]([\s\S]*?)(?=\n\[\s*section\s*:|$)/gi;
    const sections = [];
    let match;
    while ((match = sectionRegex.exec(src)) !== null) {
      const rawHeaderTitle = String(match[1] || "").trim();
      const forceTable = /\|\s*table\s*$/i.test(rawHeaderTitle);
      const cleanHeaderTitle = rawHeaderTitle.replace(/\|\s*table\s*$/i, "").trim();
      const content = String(match[2] || "").trim();
      sections.push({ rawHeaderTitle, cleanHeaderTitle, forceTable, content });
    }
    return sections;
  }

  const SECTION_ALIAS_MAP = {
    shortinfo: "Short Information",
    "short info": "Short Information",
    "short information": "Short Information",
    eligibility: "Eligibility",
    importantdates: "Important Dates",
    "important dates": "Important Dates",
    applicationfee: "Application Fee",
    "application fee": "Application Fee",
    "application fees": "Application Fee",
    selectionprocess: "Selection Process",
    "selection process": "Selection Process",
    importantlinks: "Important Links",
    "important links": "Important Links",
    importantquestions: "Important Questions",
    "important questions": "Important Questions",
    faq: "Important Questions",
    "अक्सर पूछे जाने वाले प्रश्न": "Important Questions"
  };

  function canonicalSectionTitle(raw) {
    let t = String(raw || "").trim();
    const forceTable = /\|\s*table\s*$/i.test(t);
    t = t.replace(/\|\s*table\s*$/i, "").trim();
    const spaced = t.toLowerCase().replace(/\s+/g, " ");
    const compact = spaced.replace(/\s+/g, "");
    const canonical = SECTION_ALIAS_MAP[spaced] || SECTION_ALIAS_MAP[compact] || t;
    return forceTable ? `${canonical} | table` : canonical;
  }

  function rebuildPublisherDocument(sections) {
    const parts = [];
    for (const sec of sections) {
      const rawTitle = sec.cleanHeaderTitle || sec.rawHeaderTitle || "";
      const forceTable = Boolean(sec.forceTable) || /\|\s*table\s*$/i.test(String(rawTitle));
      let title = canonicalSectionTitle(rawTitle);
      if (forceTable && !/\|\s*table\s*$/i.test(title)) title = `${title} | table`;
      const body = String(sec.content || "").trim();
      parts.push(`[Section: ${title}]`);
      if (body) parts.push(body);
    }
    return parts.length ? `${parts.join("\n")}\n` : "";
  }

  function tryPreserveStructuredInput(text) {
    const normalized = splitInlineSectionHeaders(String(text || "").trim());
    if (!/\[\s*section\s*:/i.test(normalized)) return null;
    const sections = parseSectionsFromText(normalized);
    if (!sections.length) return null;
    const meaningful = sections.filter((s) => {
      const body = String(s.content || "").trim();
      return body.length > 0 && body !== "—";
    });
    if (meaningful.length >= 2) return rebuildPublisherDocument(sections);
    if (meaningful.length === 1 && sections.length === 1 && meaningful[0].content.trim().length >= 40) {
      return rebuildPublisherDocument(sections);
    }
    return null;
  }

  function linesForBucketDetection(text) {
    const normalized = splitInlineSectionHeaders(String(text || "").trim());
    const parsed = parseSectionsFromText(normalized);
    if (parsed.length) {
      return parsed.flatMap((sec) =>
        String(sec.content || "")
          .split("\n")
          .map((x) => x.trim())
          .filter((x) => x.length && !/^\[\s*section\s*:/i.test(x))
      );
    }
    return normalized
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length);
  }

  function detectSections(text) {
    const buckets = {
      dates: [],
      qualification: [],
      age: [],
      vacancy: [],
      selection: [],
      links: [],
      state: [],
      fee: [],
      faq: [],
      other: []
    };
    const lines = linesForBucketDetection(text);
    for (const line of lines) {
      if (isNoiseLine(line)) continue;
      const k = classifyLine(line);
      buckets[k].push(line);
    }
    for (const key of Object.keys(buckets)) {
      buckets[key] = uniq(buckets[key]);
    }
    return buckets;
  }

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  function formatNumericDayMonthYear(d, mo, yStr) {
    const day = parseInt(d, 10);
    const month = parseInt(mo, 10);
    if (Number.isNaN(day) || Number.isNaN(month) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    let year = parseInt(yStr, 10);
    if (Number.isNaN(year)) return null;
    if (yStr.length === 2) {
      year = year >= 70 ? 1900 + year : 2000 + year;
    }
    if (year < 1900 || year > 2100) return null;
    return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
  }

  function isNonApplicationDateContext(line) {
    const l = line.toLowerCase();
    if (
      /\b(date\s*of\s*birth|d\.?o\.?b\.?|born\s+(on|before|after)|birth\s*date|father'?s?\s*name|mother'?s?\s*name|matriculation\s+certificate\s+date|जन्म\s*तिथि)\b/i.test(
        l
      )
    ) {
      return true;
    }
    if (/\b(certificate\s+valid|issued\s+not\s+earlier|not\s+later\s+than\s+.*certificate|validity\s+of)\b/i.test(l)) {
      return true;
    }
    if (/\b(reckon|cut[\s-]*off\s*date\s*for\s*age|age\s*count)\b/i.test(l) && /\b(19|20)\d{2}\b/.test(l)) {
      return true;
    }
    return false;
  }

  function extractStrictDateFromText(raw) {
    const line = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) return null;
    if (isNonApplicationDateContext(line)) return null;
    if (
      /\b(notify\s*soon|to\s*be\s*(announced|notified|intimated)|will\s*be\s*(notified|announced|intimated)|t\.?\s*b\.?\s*a\.?|अभी\s*घोषित)\b/i.test(
        line
      )
    ) {
      return "Notify Soon";
    }
    const reWordDMY =
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(\d{4})\b/i;
    const mWord = line.match(reWordDMY);
    if (mWord) {
      const day = parseInt(mWord[1], 10);
      const mon = mWord[2].slice(0, 1).toUpperCase() + mWord[2].slice(1).toLowerCase();
      const year = parseInt(mWord[3], 10);
      return `${day} ${mon} ${year}`;
    }
    const reWordMDY =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*,?\s*(\d{4})\b/i;
    const mWord2 = line.match(reWordMDY);
    if (mWord2) {
      const mon = mWord2[1].slice(0, 1).toUpperCase() + mWord2[1].slice(1).toLowerCase();
      const day = parseInt(mWord2[2], 10);
      const year = parseInt(mWord2[3], 10);
      return `${day} ${mon} ${year}`;
    }
    const reOrdinal =
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(\d{4})\b/i;
    const mOrd = line.match(reOrdinal);
    if (mOrd) {
      const day = parseInt(mOrd[1], 10);
      const mon = mOrd[2].slice(0, 1).toUpperCase() + mOrd[2].slice(1).toLowerCase();
      const year = parseInt(mOrd[3], 10);
      return `${day} ${mon} ${year}`;
    }
    const reNum = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
    let best = null;
    let m;
    while ((m = reNum.exec(line)) !== null) {
      const formatted = formatNumericDayMonthYear(m[1], m[2], m[3]);
      if (formatted) best = formatted;
    }
    return best;
  }

  function extractDateValueForDisplay(line) {
    const raw = String(line || "").trim();
    if (isNonApplicationDateContext(raw)) return "—";
    const direct = extractStrictDateFromText(raw);
    if (direct) return direct;
    const tail = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "";
    if (tail && tail !== raw) {
      if (isNonApplicationDateContext(tail)) return "—";
      const fromTail = extractStrictDateFromText(tail);
      if (fromTail) return fromTail;
    }
    return "—";
  }

  function formatImportantDatesFromBucket(dates) {
    const slots = [
      "Notification Date",
      "Application Start Date",
      "Last Date",
      "Fee Payment Last Date",
      "Exam Date"
    ];
    const values = ["—", "—", "—", "—", "—"];
    const consumed = new Set();

    function slotForLine(low) {
      if (/fee\s*(payment|payable)?|challan|payment\s*last|fee\s*last/i.test(low)) return 3;
      if (/notification|publish|issue|विज्ञापन/i.test(low)) return 0;
      if (/application\s*start|opening|commence|registration\s*start|apply\s*from|start\s*date/i.test(low)) return 1;
      if (/last\s*date|closing|submission\s*last|end\s*date|आखिरी/i.test(low)) return 2;
      if (/exam\s*(date)?|tier|written\s*exam|pt\s*date|mains|परीक्षा\s*तिथि/i.test(low)) return 4;
      return -1;
    }

    dates.forEach((line, di) => {
      const raw = line.replace(/^[-*•]\s*/, "").trim();
      const low = raw.toLowerCase();
      const extracted = extractDateValueForDisplay(raw);
      const idx = slotForLine(low);
      if (idx >= 0 && values[idx] === "—" && extracted !== "—") {
        values[idx] = extracted;
        consumed.add(di);
      }
    });

    let next = 0;
    dates.forEach((line, di) => {
      if (consumed.has(di)) return;
      const raw = line.replace(/^[-*•]\s*/, "").trim();
      const extracted = extractDateValueForDisplay(raw);
      if (extracted === "—") return;
      while (next < 5 && values[next] !== "—") next += 1;
      if (next < 5) values[next++] = extracted;
    });

    return slots.map((label, i) => `${label}: ${values[i]}`).join("\n");
  }

  function formatImportantLinksFromBucket(links) {
    if (!links.length) return "—";
    const labels = ["Apply Online", "Official Website", "Notification PDF", "More"];
    return links
      .map((raw, i) => {
        const t = raw.trim().replace(/^[-*•]\s*/, "");
        const eqIdx = t.indexOf("=");
        if (eqIdx > 0 && /https?:/i.test(t)) {
          const left = t.slice(0, eqIdx).trim();
          const right = t.slice(eqIdx + 1).trim().split(/\s/)[0];
          if (left && /https?:\/\//i.test(right)) return `${left}=${right}`;
        }
        const urlMatch = t.match(/https?:\/\/[^\s)]+/i);
        let url = urlMatch ? urlMatch[0] : "";
        if (!url) {
          const w = t.match(/www\.[^\s)]+/i);
          if (w) url = `https://${w[0]}`;
        }
        const label = labels[i] || `Link ${i + 1}`;
        return url ? `${label}=${url}` : `${label}=—`;
      })
      .join("\n");
  }

  function extractQualificationSnippet(line) {
    const t = line.replace(/^[-*•]\s*/, "").trim();
    if (/\b(nationality|marital\s*status|certificate\s+must|self\s*attested| oci\b)\b/i.test(t)) {
      const m0 = t.match(
        /\b(10th|12th|intermediate|diploma|graduate|graduation|post\s*graduate|postgraduate|degree|b\.?e\.?|b\.?tech|b\.?sc|m\.?a|m\.?sc|ph\.?d|matric)\b[^.\n]{0,80}/i
      );
      return m0 ? m0[0].replace(/\s+/g, " ").trim() : "—";
    }
    const m = t.match(
      /\b(10th|12th|intermediate|diploma|graduate|graduation|post\s*graduate|postgraduate|degree|b\.?e\.?|b\.?tech|b\.?sc|m\.?a|m\.?sc|ph\.?d|matric)\b[^.\n]{0,80}/i
    );
    if (m) return m[0].replace(/\s+/g, " ").trim();
    const after = t.includes(":") ? t.split(":").slice(1).join(":").trim() : t;
    return after.replace(/\s+/g, " ").trim().slice(0, 100) || t.slice(0, 100);
  }

  function extractAgeRangeOnly(line) {
    const t = line.replace(/^[-*•]\s*/, "").trim();
    const m = t.match(/\b(\d{1,2}\s*[-–]\s*\d{1,2})\b/);
    if (m) return m[1].replace(/\s/g, "");
    const m2 = t.match(/minimum\s*(\d{1,2}).{0,20}(\d{1,2})/i);
    if (m2) return `${m2[1]}-${m2[2]}`;
    const m3 = t.match(/\bage\s*(\d{1,2}\s*[-–]\s*\d{1,2})/i);
    if (m3) return m3[1].replace(/\s/g, "");
    return t.replace(/\s+/g, " ").trim().slice(0, 48);
  }

  function formatStateLine(stateLines) {
    if (!stateLines.length) return "—";
    const parts = stateLines.map((s) => {
      const t = s.replace(/^[-*•]\s*/, "").trim();
      const m = t.match(/state\s*[:/-]\s*(.+)/i);
      if (m) return m[1].replace(/\s+/g, " ").trim().slice(0, 80);
      return t.replace(/\s+/g, " ").trim().slice(0, 80);
    });
    return parts.filter(Boolean).join(", ") || "—";
  }

  function formatSelectionSteps(selection) {
    if (!selection.length) return "—";
    const out = [];
    const seen = new Set();
    for (const raw of selection) {
      const l = raw.toLowerCase();
      if (/\b(syllabus|marks|negative\s*mark|exam\s*pattern|paper\s*duration|qualifying\s+marks)\b/i.test(l)) {
        continue;
      }
      if (/(written|objective|cbte|cbt)/i.test(l) && /interview/i.test(l)) {
        if (!seen.has("written exam")) {
          seen.add("written exam");
          out.push("- Written Exam");
        }
        if (!seen.has("interview")) {
          seen.add("interview");
          out.push("- Interview");
        }
        continue;
      }
      let label = "";
      if (/(written|objective|cbte|computer\s*based)/i.test(l)) label = "Written Exam";
      else if (/(personal\s*)?interview|oral\s*test/i.test(l)) label = "Interview";
      else if (/physical|pet|pst|efficiency|measurement/i.test(l)) label = "Physical Test";
      else if (/document|dv\b|verification/i.test(l)) label = "Document Verification";
      else if (/\btest\b|tier|phase/i.test(l)) label = raw.replace(/^[-*•]\s*/, "").trim().slice(0, 50);
      if (!label) label = raw.replace(/^[-*•]\s*/, "").trim().slice(0, 55);
      const k = label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`- ${label}`);
    }
    return out.length ? out.join("\n") : "—";
  }

  function formatVacancyStructured(vacancy) {
    if (!vacancy.length) return "—";
    return (
      vacancy
        .map((raw) => {
          let t = raw.replace(/^[-*•]\s*/, "").trim();
          if (/\b(candidates?\s+are|therefore|accordingly|shall\s+be\s+eligible|general\s+information)\b/i.test(t)) {
            return "";
          }
          if (t.length > 140) t = t.slice(0, 140).trim();
          const parts = t.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
          if (parts.length >= 2 && /\d/.test(parts[parts.length - 1])) {
            return parts.join(", ");
          }
          const nums = t.match(/\d[\d,\s]*/);
          const textOnly = nums ? t.replace(nums[0], "").replace(/\s+/g, " ").trim() : t;
          if (nums && textOnly.length > 2) return `${textOnly}, ${nums[0].replace(/\s/g, "")}`;
          return t;
        })
        .filter(Boolean)
        .join("\n") || "—"
    );
  }

  function buildShortInfoLines(buckets) {
    const orgHint =
      buckets.other.find((x) => /commission|board|department|ministry|आयोग|विभाग|निगम|corporation/i.test(x)) ||
      buckets.other.find((x) => /recruitment|notification|police|railway|ssc|upsc|vacancy|भर्ती/i.test(x)) ||
      buckets.other[0] ||
      "—";
    let line2 = "—";
    if (buckets.vacancy[0]) {
      line2 = buckets.vacancy[0].replace(/^[-*•]\s*/, "").trim().slice(0, 140);
    }
    const joined = buckets.vacancy.join(" ");
    const total =
      joined.match(/(?:कुल|total)\s*(?:posts?|पद)?\s*[:\s]*([\d,]+)/i) || joined.match(/\b([\d,]{2,})\s*posts?\b/i);
    if (total && !line2.includes(total[1])) {
      line2 = line2 === "—" ? `Total posts: ${total[1]}` : `${line2} | Total posts: ${total[1]}`;
    }
    return [orgHint.replace(/\s+/g, " ").trim().slice(0, 200), line2.replace(/\s+/g, " ").trim().slice(0, 200)];
  }

  function formatFaqFromBucket(faqLines) {
    if (!faqLines || !faqLines.length) return "";
    return faqLines
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter((l) => l.length > 0 && !/^Q:\s*—\s*$/i.test(l) && !/^A:\s*—\s*$/i.test(l))
      .join("\n");
  }

  function buildFaqFromBuckets(buckets) {
    return formatFaqFromBucket(buckets.faq);
  }

  function normalizeSectionFormatting(text) {
    let s = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u200b/g, "")
      .trim();
    if (!s) return "";
    s = s.replace(/,\s*\[Section:/g, "\n[Section:");
    s = s.replace(/([^\n])\[Section:/g, "$1\n[Section:");
    s = s.replace(/\]\s*\[Section:/g, "]\n[Section:");
    const headerRe = /\[Section:\s*([^\]\r\n]+)\]\s*/gi;
    const hits = [];
    let m;
    while ((m = headerRe.exec(s)) !== null) {
      hits.push({ name: m[1].trim(), headerEnd: m.index + m[0].length, start: m.index });
    }
    if (!hits.length) return s;
    const parts = [];
    for (let i = 0; i < hits.length; i++) {
      const { name, headerEnd } = hits[i];
      const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : s.length;
      let body = s.slice(headerEnd, bodyEnd).trim();
      body = body
        .split("\n")
        .map((ln) => ln.trim())
        .filter((ln) => ln.length > 0)
        .join("\n");
      parts.push(`[Section: ${canonicalSectionTitle(name)}]`);
      if (body) parts.push(body);
    }
    return `${parts.join("\n")}\n`;
  }

  function formatImportantDatesPublisher(dates) {
    if (!dates.length) return "—";
    const rows = dates
      .map((line) => {
        const t = line.replace(/^[-*•]\s*/, "").trim();
        if (!t || /^\[\s*section\s*:/i.test(t)) return "";
        if (/:\s*/.test(t)) return t;
        const val = extractDateValueForDisplay(t);
        return val !== "—" ? val : t;
      })
      .filter(Boolean);
    return rows.length ? rows.join("\n") : "—";
  }

  function formatApplicationFeeFromBucket(fee) {
    if (!fee || !fee.length) return "—";
    const rows = fee.map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
    return rows.length ? rows.join("\n") : "—";
  }

  function isPublisherTableBody(body) {
    const content = String(body || "").trim();
    if (!content) return false;
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;

    function cols(line) {
      const t = line.replace(/^\s*\d+[\s.)-]+/, "").trim();
      if (t.includes("|")) return t.split("|").map((x) => x.trim()).filter(Boolean).length;
      if (t.includes("\t")) return t.split("\t").map((x) => x.trim()).filter(Boolean).length;
      return (t.match(/,/g) || []).length + 1;
    }

    const counts = lines.map(cols);
    if (counts[0] < 2 || !counts.every((c) => c === counts[0])) return false;
    const header = lines[0].toLowerCase();
    const hasHeaderHint = /post|category|vacancy|total|ur|obc|sc|st|count|पद|वर्ग/.test(header);
    const hasDigits = lines.slice(1).some((l) => /\d/.test(l));
    return hasDigits || (hasHeaderHint && lines.length >= 2);
  }

  function bucketsToStructuredDocument(buckets) {
    const [short1, short2] = buildShortInfoLines(buckets);

    const q = buckets.qualification.length
      ? buckets.qualification.map((x) => `- ${extractQualificationSnippet(x)}`).join("\n")
      : "—";
    const a = buckets.age.length ? buckets.age.map((x) => `- ${extractAgeRangeOnly(x)}`).join("\n") : "—";
    const st = formatStateLine(buckets.state);
    const d = formatImportantDatesPublisher(buckets.dates);
    const fee = formatApplicationFeeFromBucket(buckets.fee);
    const v = formatVacancyStructured(buckets.vacancy);
    const vacancyTitle = isPublisherTableBody(v) ? "Vacancy | table" : "Vacancy";
    const sel = formatSelectionSteps(buckets.selection);
    const links = formatImportantLinksFromBucket(buckets.links);
    const faq = buildFaqFromBuckets(buckets);
    const shortBody = [short1, short2].filter((x) => x && x !== "—").join("\n") || short1 || "—";

    let doc = `[Section: Short Information]
${shortBody}

[Section: Eligibility]
Qualification: ${q}
Age Limit: ${a}
State: ${st}

[Section: Important Dates]
${d}

[Section: Application Fee]
${fee}

[Section: Selection Process]
${sel}

[Section: ${vacancyTitle}]
${v}

[Section: Important Links]
${links}
`;
    if (faq) {
      doc += `\n[Section: Important Questions]\n${faq}\n`;
    }
    return doc;
  }

  const GARBAGE = /\b(rti|annexure|syllabus|how\s+to\s+apply|exam\s*pattern|marks\s*distribution|click\s+here\s+to\s+apply|negative\s*marking)\b/i;
  const SECTION_BLOCK_RE = /(\[Section:\s*[^\]]+\]\s*)([\s\S]*?)(?=\n\[Section:|$)/gi;

  function stripGarbageLines(block) {
    const lines = String(block || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const kept = lines.filter((t) => {
      if (GARBAGE.test(t) && t.length > 35 && !/\d{1,2}[./-]\d{1,2}/.test(t)) return false;
      return true;
    });
    return kept.length ? kept.join("\n") : "—";
  }

  function setSectionContent(text, sectionName, newBody) {
    const esc = String(sectionName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(\\[Section:\\s*${esc}\\]\\s*)([\\s\\S]*?)(?=\\n\\[Section:|$)`, "i");
    if (!re.test(text)) return text;
    return text.replace(re, (_, header) => `${header}${String(newBody || "").trim()}\n`);
  }

  function setSectionContentAny(text, names, newBody) {
    let out = text;
    for (const name of names) {
      const next = setSectionContent(out, name, newBody);
      if (next !== out) return next;
    }
    return out;
  }

  function hasMeaningfulDates(text) {
    const m =
      text.match(/\[Section:\s*Important\s*Dates\]\s*([\s\S]*?)(?=\n\[Section:|$)/i) ||
      text.match(/\[Section:\s*ImportantDates\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
    if (!m) return false;
    const body = m[1].replace(/—/g, "").trim();
    return (
      body.length > 2 &&
      (/\d{1,2}[./-]\d{1,2}/.test(body) ||
        /\b(september|january|february|march|april|may|june|july|august|october|november|december)\b/i.test(
          body
        ) ||
        /\b(last|exam|start|notification|date|schedule|apply)\b/i.test(body))
    );
  }

  function hasMeaningfulVacancy(text) {
    const m = text.match(/\[Section:\s*Vacancy(?:\s*\|\s*table)?\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
    if (!m) return false;
    const body = m[1].replace(/—/g, "").trim();
    return body.length > 2 && /\d/.test(body);
  }

  function validateAndRepair(structured, buckets) {
    let text = String(structured || "").trim();
    text = text.replace(SECTION_BLOCK_RE, (_, header, body) => `${header}${stripGarbageLines(body)}\n`);

    if (!hasMeaningfulDates(text) && buckets.dates.length) {
      text = setSectionContentAny(text, ["Important Dates", "ImportantDates"], formatImportantDatesPublisher(buckets.dates));
    }
    if (!hasMeaningfulVacancy(text) && buckets.vacancy.length) {
      const body = formatVacancyStructured(buckets.vacancy);
      const title = isPublisherTableBody(body) ? "Vacancy | table" : "Vacancy";
      text = setSectionContentAny(text, [title, "Vacancy | table", "Vacancy"], body);
    }
    if (buckets.fee && buckets.fee.length) {
      const feeBody = buckets.fee.map((l) => l.replace(/^[-*•]\s*/, "").trim()).join("\n");
      const feeMatch = text.match(/\[Section:\s*Application\s*Fee\]\s*([\s\S]*?)(?=\n\[Section:|$)/i);
      const feeExisting = feeMatch ? feeMatch[1].replace(/—/g, "").trim() : "";
      if (!feeExisting) {
        text = setSectionContentAny(text, ["Application Fee"], feeBody);
      }
    }

    const ok =
      hasMeaningfulDates(text) ||
      hasMeaningfulVacancy(text) ||
      (buckets.dates.length === 0 && buckets.vacancy.length === 0);
    return { ok: !!ok, text };
  }

  function structurePlainTextIntoSections(plainText) {
    const cleaned = smartCleanJobText(plainText);
    const buckets = detectSections(cleaned);
    return normalizeSectionFormatting(bucketsToStructuredDocument(buckets));
  }

  function trimShortInfoInStructuredText(text) {
    const t = String(text || "");
    const re = /\[Section:\s*(Short\s*Information|ShortInfo)\]\s*([\s\S]*?)(?=\n\[Section:|$)/i;
    const m = t.match(re);
    if (!m) return t;
    const body = m[2].trim();
    const trimmed = body.split("\n").filter(Boolean).slice(0, 4).join("\n") || "—";
    const start = m.index ?? 0;
    const end = start + m[0].length;
    return `${t.slice(0, start)}[Section: Short Information]\n${trimmed}${t.slice(end)}`;
  }

  function finalizeStructuredJobOutput(aiResult, cleanedSource) {
    const preserved = tryPreserveStructuredInput(cleanedSource);
    if (preserved) {
      return normalizeSectionFormatting(preserved);
    }

    let r = normalizeSectionFormatting(
      String(aiResult || "")
        .trim()
        .replace(/\{\{TEXT\}\}/gi, "")
        .replace(/\$\{text\}/gi, "")
    );
    const src = smartCleanJobText(String(cleanedSource || "").trim());
    const buckets = detectSections(src);

    const junk = /^(Input too short|No usable data found)$/i;
    if (junk.test(r)) r = "";

    if (r && /\[Section:\s*(Eligibility|Short\s*Information|ShortInfo|Important\s*Dates|ImportantDates)\]/i.test(r)) {
      return normalizeSectionFormatting(validateAndRepair(trimShortInfoInStructuredText(r), buckets).text);
    }
    if (r && /\[Section:/i.test(r)) {
      return normalizeSectionFormatting(validateAndRepair(trimShortInfoInStructuredText(r), buckets).text);
    }

    if (src.length >= 50) {
      return normalizeSectionFormatting(
        validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(src)), buckets).text
      );
    }
    if (r.length > 0) {
      return normalizeSectionFormatting(
        validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections(r)), buckets).text
      );
    }
    return normalizeSectionFormatting(
      validateAndRepair(trimShortInfoInStructuredText(structurePlainTextIntoSections("—")), buckets).text
    );
  }

  window.__jobSectionUtil = {
    structurePlainTextIntoSections,
    trimShortInfoInStructuredText,
    finalizeStructuredJobOutput,
    tryPreserveStructuredInput,
    smartCleanJobText,
    detectSections
  };
})();
