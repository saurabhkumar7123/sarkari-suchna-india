const path = require("path");
const fileService = require("../../services/file.service");
const { resolveUrl } = require("../../utils/escapeHtml");

const pdfDir = path.join(process.cwd(), "storage", "uploads", "pdf");

const getNotifications = async (req, res) => {
  try {
    let files = [];
    try {
      files = await fileService.readdir(pdfDir);
    } catch {
      files = [];
    }

    const notifications = (
      await Promise.all(
        files
          .filter((name) => /\.pdf$/i.test(String(name || "")))
          .map(async (name) => {
            try {
              const stat = await fileService.stat(path.join(pdfDir, name));
              const url = `/pdf/${name}`;
              return {
                name,
                url,
                absoluteUrl: resolveUrl(url),
                date: stat.mtime
              };
            } catch {
              return null;
            }
          })
      )
    ).filter(Boolean);

    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ success: true, data: notifications });
  } catch {
    return res.status(500).json({ success: false, data: [] });
  }
};

module.exports = { getNotifications };
