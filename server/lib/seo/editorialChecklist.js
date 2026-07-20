"use strict";

/**
 * Package 4F — Reusable editorial checklist (advisory).
 *
 * Operators can view completion progress. No automatic corrections.
 */

const { parseSectionsFromText } = require("../../../generator/parse/sectionParse");

const CHECKLIST_ITEMS = Object.freeze([
  {
    id: "required_blocks",
    label: "Required content blocks",
    description: "Core structured sections are present"
  },
  {
    id: "image_availability",
    label: "Image availability",
    description: "At least one content image or logo reference when expected"
  },
  {
    id: "important_links",
    label: "Important links",
    description: "Official / apply / notification links present"
  },
  {
    id: "vacancy_information",
    label: "Vacancy information",
    description: "Vacancy or total posts details present"
  },
  {
    id: "dates",
    label: "Dates",
    description: "Important dates or last date present"
  },
  {
    id: "eligibility",
    label: "Eligibility",
    description: "Eligibility / qualification details present"
  },
  {
    id: "selection_process",
    label: "Selection process",
    description: "Selection process details present"
  },
  {
    id: "application_process",
    label: "Application process",
    description: "How to apply / application process present"
  }
]);

function hasPattern(text, pattern) {
  return pattern.test(String(text || ""));
}

function sectionTitles(rawText) {
  return parseSectionsFromText(rawText).map((s) => String(s.cleanHeaderTitle || "").trim());
}

function evaluateChecklistItem(id, ctx) {
  const text = ctx.text;
  const html = ctx.html;
  const titles = ctx.titles;
  const joinedTitles = titles.join(" | ");

  switch (id) {
    case "required_blocks": {
      const needed = [/short\s*info/i, /important\s*dates?/i, /eligibility|qualification/i];
      const hit = needed.filter((re) => titles.some((t) => re.test(t)) || re.test(text)).length;
      return {
        ok: hit >= 2,
        detail: `${hit}/3 core block signals found`
      };
    }
    case "image_availability": {
      const ok =
        /<img\b/i.test(html) ||
        /\.(png|jpe?g|webp|gif|svg)\b/i.test(html) ||
        /\.(png|jpe?g|webp|gif|svg)\b/i.test(text) ||
        ctx.imageAvailable === true;
      return {
        ok,
        detail: ok ? "Image reference detected" : "No image reference detected"
      };
    }
    case "important_links": {
      const ok =
        /important\s*links?/i.test(joinedTitles) ||
        /important\s*links?/i.test(text) ||
        /https?:\/\//i.test(text) ||
        /href\s*=/i.test(html);
      return {
        ok,
        detail: ok ? "Link signals present" : "Important links missing"
      };
    }
    case "vacancy_information": {
      const ok =
        Boolean(ctx.totalPosts) ||
        /vacancy|vacancies|total\s*posts?/i.test(joinedTitles) ||
        hasPattern(text, /\b(vacancy|vacancies|total\s*posts?)\b/i);
      return {
        ok,
        detail: ok ? "Vacancy information present" : "Vacancy information missing"
      };
    }
    case "dates": {
      const ok =
        Boolean(ctx.lastDate) ||
        /important\s*dates?/i.test(joinedTitles) ||
        hasPattern(text, /\b(last\s*date|important\s*dates?|closing\s*date)\b/i);
      return {
        ok,
        detail: ok ? "Date information present" : "Dates missing"
      };
    }
    case "eligibility": {
      const ok =
        Boolean(ctx.qualification) ||
        /eligibility|qualification/i.test(joinedTitles) ||
        hasPattern(text, /\b(eligibility|qualification)\b/i);
      return {
        ok,
        detail: ok ? "Eligibility present" : "Eligibility missing"
      };
    }
    case "selection_process": {
      const ok =
        /selection/i.test(joinedTitles) || hasPattern(text, /\bselection\s*process\b|\bwritten\s*test\b/i);
      return {
        ok,
        detail: ok ? "Selection process present" : "Selection process missing"
      };
    }
    case "application_process": {
      const ok =
        /how\s*to\s*apply|application\s*process|apply\s*online/i.test(joinedTitles) ||
        hasPattern(text, /\b(how\s*to\s*apply|application\s*process|apply\s*online)\b/i);
      return {
        ok,
        detail: ok ? "Application process present" : "Application process missing"
      };
    }
    default:
      return { ok: false, detail: "Unknown checklist item" };
  }
}

/**
 * @param {object} input
 */
function buildEditorialChecklist(input = {}) {
  const text = String(input.rawText || input.content || input.text || "");
  const html = String(input.contentHtml || input.content || "");
  const titles = sectionTitles(text);
  const ctx = {
    text,
    html,
    titles,
    totalPosts: input.totalPosts || input.total_posts || null,
    lastDate: input.lastDate || input.last_date || null,
    qualification: input.qualification || null,
    imageAvailable: input.imageAvailable === true
  };

  const items = CHECKLIST_ITEMS.map((def) => {
    const result = evaluateChecklistItem(def.id, ctx);
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      ok: result.ok,
      detail: result.detail
    };
  });

  const completed = items.filter((i) => i.ok).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    advisory: true,
    autoCorrect: false,
    total,
    completed,
    remaining: total - completed,
    percent,
    progressLabel: `${completed}/${total} complete (${percent}%)`,
    items
  };
}

module.exports = {
  CHECKLIST_ITEMS,
  buildEditorialChecklist
};
