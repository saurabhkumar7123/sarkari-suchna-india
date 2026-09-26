const path = require("path");
const fileService = require("../../services/file.service");
const mediaService = require("../../services/media.service");
const { resolveUrl } = require("../../utils/escapeHtml");

const uploadsRoot = path.join(process.cwd(), "storage", "uploads");

function mapVirtualToDisk(relativePath) {
  const norm = path.normalize(String(relativePath).replace(/^\/+/, ""));
  const parts = norm.split(path.sep).filter(Boolean);
  if (parts.length < 2) return null;
  const [folder, ...rest] = parts;
  if (folder === "pdf") {
    return path.join(uploadsRoot, "pdf", ...rest);
  }
  if (folder === "image") {
    return path.join(uploadsRoot, "images", ...rest);
  }
  return null;
}

function parseVirtualFileQuery(file) {
  if (!file) return null;
  const normalizedFile = String(file).replace(/^\/+/, "");
  const relativePath = path.normalize(normalizedFile);
  const allowedFolders = ["pdf", "image"];
  const folder = relativePath.split(path.sep)[0];

  if (
    relativePath.includes("..") ||
    !allowedFolders.includes(folder) ||
    relativePath.endsWith(path.sep)
  ) {
    return null;
  }

  const filePath = mapVirtualToDisk(relativePath);
  if (!filePath) return null;

  const resolved = path.resolve(filePath);
  const uploadsResolved = path.resolve(uploadsRoot);
  if (!resolved.startsWith(uploadsResolved + path.sep)) {
    return null;
  }

  const fileName = path.basename(resolved);
  return { relativePath, folder, fileName, resolved };
}

function mimeFromName(type, name) {
  const n = String(name || "").toLowerCase();
  if (type === "pdf") return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return type === "image" ? "image/jpeg" : "application/octet-stream";
}

async function buildFileRecord(f, type, dir, metaStore) {
  const virtualFolder = type === "pdf" ? "pdf" : "image";
  const url = `/${virtualFolder}/` + f;
  const key = `${virtualFolder}/${f}`;
  const meta = (metaStore && metaStore[key]) || {};
  const stat = await fileService.stat(path.join(dir, f));
  return {
    id: key,
    name: f,
    title: meta.title || null,
    originalName: meta.originalName || f,
    url,
    absoluteUrl: resolveUrl(url),
    type,
    mimeType: meta.mimeType || mimeFromName(type, f),
    size: stat.size,
    date: meta.uploadedAt || stat.mtime,
    uploadedAt: meta.uploadedAt || stat.mtime,
    uploadedBy: meta.uploadedBy || null
  };
}

const getFiles = async (req, res) => {
  try {
    const pdfDir = path.join(uploadsRoot, "pdf");
    const imgDir = path.join(uploadsRoot, "images");
    const metaStore = await mediaService.readMetaStore();
    const [pdfList, imgList] = await Promise.all([
      fileService.readdir(pdfDir).catch(() => []),
      fileService.readdir(imgDir).catch(() => [])
    ]);

    const [pdfFiles, imgFiles] = await Promise.all([
      Promise.all(pdfList.map((f) => buildFileRecord(f, "pdf", pdfDir, metaStore))),
      Promise.all(imgList.map((f) => buildFileRecord(f, "image", imgDir, metaStore)))
    ]);

    const files = [...pdfFiles, ...imgFiles];
    files.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: files });
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch files" });
  }
};

const getFileDetail = async (req, res) => {
  try {
    const fileParam = req.query.file || req.params.file;
    const parsed = parseVirtualFileQuery(fileParam);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    const exists = await fileService.exists(parsed.resolved);
    if (!exists) {
      return res.status(404).json({ success: false, error: "File not found", message: "File not found" });
    }

    const metaStore = await mediaService.readMetaStore();
    const type = parsed.folder === "pdf" ? "pdf" : "image";
    const dir =
      parsed.folder === "pdf"
        ? path.join(uploadsRoot, "pdf")
        : path.join(uploadsRoot, "images");
    const record = await buildFileRecord(parsed.fileName, type, dir, metaStore);
    const usage = await mediaService.findMediaUsage(record.url);

    res.json({
      success: true,
      data: {
        ...record,
        usage,
        usageCount: usage.length,
        canDeleteSafely: usage.length === 0
      }
    });
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch file" });
  }
};

const updateFileMeta = async (req, res) => {
  try {
    const fileParam = (req.body && req.body.file) || req.query.file;
    const parsed = parseVirtualFileQuery(fileParam);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    const exists = await fileService.exists(parsed.resolved);
    if (!exists) {
      return res.status(404).json({ success: false, error: "File not found", message: "File not found" });
    }

    const title = req.body && req.body.title != null ? String(req.body.title) : undefined;
    const meta = await mediaService.setMeta(parsed.folder, parsed.fileName, {
      title
    });

    res.json({
      success: true,
      data: {
        id: meta.key,
        title: meta.title || null,
        file: `/${meta.key}`
      }
    });
  } catch {
    res.status(500).json({ success: false, error: "Failed to update media" });
  }
};

const deleteFile = async (req, res) => {
  try {
    const file = req.query.file;
    const force =
      String(req.query.force || "").toLowerCase() === "1" ||
      String(req.query.force || "").toLowerCase() === "true";

    if (!file) {
      return res.status(400).json({ success: false, error: "File required", message: "File required" });
    }

    const parsed = parseVirtualFileQuery(file);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    const publicUrl = `/${parsed.folder}/${parsed.fileName}`;
    const usage = await mediaService.findMediaUsage(publicUrl);
    if (usage.length && !force) {
      return res.status(409).json({
        success: false,
        error: "Media is referenced",
        message: "This file is referenced by published pages or drafts. Confirm force delete to proceed.",
        code: "MEDIA_IN_USE",
        usage,
        usageCount: usage.length
      });
    }

    await fileService.unlink(parsed.resolved);
    await mediaService.deleteMeta(parsed.folder, parsed.fileName).catch(() => {});

    res.json({ success: true, forced: force && usage.length > 0, usageCount: usage.length });
  } catch {
    res.status(404).json({ success: false, error: "File not found", message: "File not found" });
  }
};

module.exports = {
  getFiles,
  getFileDetail,
  updateFileMeta,
  deleteFile,
  mapVirtualToDisk,
  parseVirtualFileQuery
};
