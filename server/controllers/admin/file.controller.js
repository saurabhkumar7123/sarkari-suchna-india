const path = require("path");
const fileService = require("../../services/file.service");
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

const getFiles = async (req, res) => {
  try {
    const pdfDir = path.join(uploadsRoot, "pdf");
    const imgDir = path.join(uploadsRoot, "images");
    const [pdfList, imgList] = await Promise.all([
      fileService.readdir(pdfDir).catch(() => []),
      fileService.readdir(imgDir).catch(() => [])
    ]);

    const [pdfFiles, imgFiles] = await Promise.all([
      Promise.all(
        pdfList.map(async (f) => {
          const stat = await fileService.stat(path.join(pdfDir, f));
          return {
            name: f,
            url: "/pdf/" + f,
            absoluteUrl: resolveUrl("/pdf/" + f),
            type: "pdf",
            size: stat.size,
            date: stat.mtime
          };
        })
      ),
      Promise.all(
        imgList.map(async (f) => {
          const stat = await fileService.stat(path.join(imgDir, f));
          return {
            name: f,
            url: "/image/" + f,
            absoluteUrl: resolveUrl("/image/" + f),
            type: "image",
            size: stat.size,
            date: stat.mtime
          };
        })
      )
    ]);

    const files = [...pdfFiles, ...imgFiles];

    files.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: files });
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch files" });
  }
};

const deleteFile = async (req, res) => {
  try {
    const file = req.query.file;

    if (!file) {
      return res.status(400).json({ success: false, error: "File required", message: "File required" });
    }

    const normalizedFile = String(file).replace(/^\/+/, "");
    const relativePath = path.normalize(normalizedFile);
    const allowedFolders = ["pdf", "image"];
    const folder = relativePath.split(path.sep)[0];

    if (
      relativePath.includes("..") ||
      !allowedFolders.includes(folder) ||
      relativePath.endsWith(path.sep)
    ) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    const filePath = mapVirtualToDisk(relativePath);
    if (!filePath) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    const resolved = path.resolve(filePath);
    const uploadsResolved = path.resolve(uploadsRoot);
    if (!resolved.startsWith(uploadsResolved + path.sep)) {
      return res.status(400).json({ success: false, error: "Invalid file path", message: "Invalid file path" });
    }

    await fileService.unlink(resolved);

    res.json({ success: true });
  } catch {
    res.status(404).json({ success: false, error: "File not found", message: "File not found" });
  }
};

module.exports = {
  getFiles,
  deleteFile
};
