/**
 * Media Library helpers — metadata sidecar + usage lookup for site-hosted uploads.
 * Storage remains storage/uploads/{pdf|images}; public URLs stay /pdf/… and /image/….
 */
const path = require("path");
const fsp = require("fs/promises");
const fileService = require("./file.service");

const uploadsRoot = path.join(process.cwd(), "storage", "uploads");
const metaPath = path.join(uploadsRoot, "media-meta.json");

function virtualKey(folder, fileName) {
  const f = String(folder || "").replace(/^\/+|\/+$/g, "");
  const n = path.basename(String(fileName || ""));
  if ((f !== "pdf" && f !== "image") || !n) return null;
  return `${f}/${n}`;
}

function publicPathFromKey(key) {
  return `/${String(key || "").replace(/^\/+/, "")}`;
}

async function readMetaStore() {
  try {
    const raw = await fileService.readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMetaStore(store) {
  await fsp.mkdir(uploadsRoot, { recursive: true });
  const tmp = `${metaPath}.${process.pid}.${Date.now()}.tmp`;
  await fileService.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fsp.rename(tmp, metaPath);
}

async function getMeta(folder, fileName) {
  const key = virtualKey(folder, fileName);
  if (!key) return null;
  const store = await readMetaStore();
  const row = store[key];
  return row && typeof row === "object" ? { key, ...row } : null;
}

async function setMeta(folder, fileName, patch) {
  const key = virtualKey(folder, fileName);
  if (!key) throw new Error("Invalid media key");
  const store = await readMetaStore();
  const prev = store[key] && typeof store[key] === "object" ? store[key] : {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  if (next.title != null) next.title = String(next.title).trim().slice(0, 240);
  store[key] = next;
  await writeMetaStore(store);
  return { key, ...next };
}

async function deleteMeta(folder, fileName) {
  const key = virtualKey(folder, fileName);
  if (!key) return;
  const store = await readMetaStore();
  if (!(key in store)) return;
  delete store[key];
  await writeMetaStore(store);
}

/**
 * Find published pages + drafts that reference a site-hosted media path.
 * Soft-fail if DB is unavailable (returns []).
 */
async function findMediaUsage(publicUrlPath) {
  const needle = String(publicUrlPath || "").trim();
  if (!needle || !needle.startsWith("/")) return [];

  const fileName = path.basename(needle);
  const usages = [];

  let db;
  try {
    db = require("../config/db");
  } catch {
    return usages;
  }

  try {
    const like = `%${needle}%`;
    const likeName = fileName.length > 8 ? `%${fileName}%` : null;

    const [pageRows] = await db.query(
      `SELECT id, title, slug, status
       FROM pages
       WHERE deleted = 0
         AND (content LIKE ? OR raw_text LIKE ?${likeName ? " OR content LIKE ?" : ""})
       LIMIT 50`,
      likeName ? [like, like, likeName] : [like, like]
    );
    for (const row of pageRows || []) {
      usages.push({
        kind: "page",
        id: row.id,
        title: row.title || row.slug || `Page #${row.id}`,
        slug: row.slug || null,
        status: row.status || "published",
        href: row.slug ? `/${row.slug}` : `/admin/page-manager`
      });
    }
  } catch {
    /* pages table / DB may be unavailable in unit tests */
  }

  try {
    const like = `%${needle}%`;
    const [draftRows] = await db.query(
      `SELECT id, title, status, slug_hint
       FROM generator_drafts
       WHERE payload LIKE ?
       LIMIT 50`,
      [like]
    );
    for (const row of draftRows || []) {
      usages.push({
        kind: "draft",
        id: row.id,
        title: row.title || `Draft #${row.id}`,
        slug: row.slug_hint || null,
        status: row.status || "draft",
        href: `/generator?draftId=${row.id}`
      });
    }
  } catch {
    /* generator_drafts may be missing */
  }

  return usages;
}

module.exports = {
  uploadsRoot,
  virtualKey,
  publicPathFromKey,
  getMeta,
  setMeta,
  deleteMeta,
  readMetaStore,
  findMediaUsage
};
