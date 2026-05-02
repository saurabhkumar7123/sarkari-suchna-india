const csv = require("csv-parser");
const path = require("path");
const {
  applyTemplatePlaceholders,
  buildJobTemplateVariables
} = require("../../utils/templatePlaceholders");
const fileService = require("../../services/file.service");
const { recordActivity } = require("../../services/adminActivity.service");

const templateFile = path.join(__dirname, "../../templates/template.html");

// =============================
// 📤 CSV UPLOAD
// =============================
const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvMime = String(req.file.mimetype || "").toLowerCase();
    const csvExt = path.extname(String(req.file.originalname || "")).toLowerCase();
    const mimeOk = csvMime === "text/csv" || csvMime === "application/csv" || csvMime === "application/vnd.ms-excel";
    if (!mimeOk || csvExt !== ".csv") {
      return res.status(400).json({ error: "Only CSV allowed" });
    }

    const results = [];
    await new Promise((resolve, reject) => {
      const stream = fileService.createReadStream(req.file.path);
      const parser = csv();
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      stream.on("error", fail);
      parser.on("error", fail);

      stream
        .pipe(parser)
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          if (settled) return;
          settled = true;
          try {
            const groupedPages = {};

            results.forEach((row) => {
              if (!row.title) return;

              if (!groupedPages[row.title]) {
                groupedPages[row.title] = { sections: [], category: "" };
              }

              groupedPages[row.title].sections.push({
                section: row.section,
                content: row.content
              });

              const cat = row.category || row.tag;
              if (cat && !groupedPages[row.title].category) {
                groupedPages[row.title].category = String(cat).trim();
              }
            });

            const templateBase = await fileService.readFile(templateFile, "utf8");

            for (const title of Object.keys(groupedPages)) {
              let rawText = "";

              groupedPages[title].sections.forEach((sec) => {
                rawText += `[Section:${sec.section}]\n${sec.content}\n\n`;
              });

              const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
              const slug = fileName.replace(/\.html$/i, "");
              const category =
                String(groupedPages[title].category || "").trim() || "general";

              const variables = buildJobTemplateVariables({
                title,
                text: rawText,
                slug,
                category,
                normalizedStatus: "general"
              });

              const html = applyTemplatePlaceholders(templateBase, variables);
              const outputPath = path.join(process.cwd(), "generated", "jobs", fileName);

              await fileService.writeFile(outputPath, html, "utf8");
            }

            await fileService.unlink(req.file.path);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
    });
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "csv_upload",
      target: req.file && req.file.originalname ? req.file.originalname : "",
      status: "success",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});
    return res.json({ status: "success" });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    if (req && req.file && req.file.path) {
      await fileService.unlink(req.file.path).catch(() => {});
    }
    await recordActivity({
      admin: req.user && req.user.username ? req.user.username : "admin",
      action: "csv_upload",
      target: req.file && req.file.originalname ? req.file.originalname : "",
      status: "fail",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || ""),
      requestId: req.id || ""
    }).catch(() => {});
    return res.status(500).json({ success: false, message: "CSV processing failed" });
  }
};

module.exports = { uploadCSV };
