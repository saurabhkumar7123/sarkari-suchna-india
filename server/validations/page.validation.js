exports.validatePage = (req, res, next) => {
  const title = req.body && typeof req.body.title === "string" ? req.body.title : "";
  const contentRaw = req.body ? req.body.content : "";
  const textRaw = req.body ? req.body.text : "";
  const content = typeof contentRaw === "string" ? contentRaw : "";
  const text = typeof textRaw === "string" ? textRaw : "";
  const mergedContent = content.trim() || text.trim();

  if (title.trim().length < 5 || !mergedContent) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  if (mergedContent.length < 20) {
    return res.status(400).json({
      success: false,
      message: "Valid content required (min 20 chars)"
    });
  }

  next();
};

exports.validateSlugParam = (req, res, next) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) {
    return res.status(400).json({ message: "Invalid slug parameter" });
  }
  next();
};

exports.validateSmallBoxSlotParam = (req, res, next) => {
  const slot = Number(req.params.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
    return res.status(400).json({ success: false, message: "Invalid slot (must be 1–8)" });
  }
  req.params.slot = String(slot);
  next();
};