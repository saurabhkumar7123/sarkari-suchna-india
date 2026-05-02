/* eslint-disable no-console */
/**
 * One-shot proof: same post_name/total_posts as form FINAL_CHECK / 12345
 * through insertPage + DB SELECT (then ROLLBACK — no permanent row).
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../server/config/db");
const pageRepository = require("../server/repositories/page.repository");

const FRONTEND_PAYLOAD = {
  title: "Proof title for FINAL_CHECK save",
  post_name: "FINAL_CHECK",
  total_posts: "12345",
  status: "new form",
  category: "proof",
  qualification: null,
  state: null,
  department: null,
  pageUrl: "",
  text: "x".repeat(100) + " [Section: Vacancy]\nTotal posts 12345",
  position: "normal",
  breaking: false,
  breakingOrder: 0,
  eventTime: null,
  lastDate: null,
  id: "",
  oldSlug: ""
};

async function main() {
  console.log("1. FRONTEND PAYLOAD:", FRONTEND_PAYLOAD);

  const slug = `proof-final-${Date.now()}`;
  const postName = FRONTEND_PAYLOAD.post_name;
  const totalPosts = FRONTEND_PAYLOAD.total_posts;

  console.log("2. RAW BODY (simulated):", FRONTEND_PAYLOAD);
  console.log("3. BODY KEYS:", Object.keys(FRONTEND_PAYLOAD));
  console.log("4. CONTROLLER VALUES:", { postName, totalPosts });

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const id = await pageRepository.insertPage(
      {
        title: FRONTEND_PAYLOAD.title,
        slug,
        finalHTML: "<html>proof</html>",
        text: FRONTEND_PAYLOAD.text,
        normalizedStatus: "new form",
        category: FRONTEND_PAYLOAD.category,
        qualification: null,
        state: null,
        department: null,
        postName,
        totalPosts,
        lastDate: null,
        position: "normal",
        breaking: false,
        breakingOrder: 0,
        eventTime: null
      },
      conn
    );

    const [[row]] = await conn.query(
      "SELECT `id`, `slug`, `post_name`, `total_posts` FROM `pages` WHERE `id` = ? LIMIT 1",
      [id]
    );
    console.log("7. DB VERIFY (manual SELECT after insertPage):", row);
    await conn.rollback();
    console.log("ROLLBACK done (proof row not kept).");
  } catch (e) {
    await conn.rollback();
    console.error("FAIL:", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end().catch(() => {});
  }
}

main();
