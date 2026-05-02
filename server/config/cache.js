const NodeCache = require("node-cache");

// 🔥 LOCAL MEMORY CACHE (fallback / small data)
const cache = new NodeCache({
  stdTTL: 120, // 2 minutes ✔
  checkperiod: 60
});

module.exports = cache;