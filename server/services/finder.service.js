const pageRepository = require("../repositories/page.repository");
const { normalizeLastDate, pickLastDateColumn } = require("./page.service");

async function getFinderData() {
  const batchSize = Math.min(5000, Math.max(100, Number(process.env.FINDER_BATCH_SIZE || 1000)));
  const maxRows = Math.max(batchSize, Number(process.env.FINDER_MAX_ROWS || 200000));
  const results = [];
  let offset = 0;

  while (results.length < maxRows) {
    const page = await pageRepository.selectFinderPage(batchSize, offset);
    if (!page.length) break;
    results.push(...page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  const cleanPages = results.map((p) => ({
    title: p.title,
    url: "/" + p.slug,
    rawText: p.raw_text,
    lastDate: normalizeLastDate(pickLastDateColumn(p))
  }));

  return cleanPages;
}

module.exports = { getFinderData };
