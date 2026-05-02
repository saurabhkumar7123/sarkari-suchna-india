const { createClient } = require("redis");
const logger = require("../utils/logger");

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10)
  }
});

client.on("error", (err) => {
  logger.error("Redis client error", { message: err.message });
});

/**
 * Connect Redis (web process should await this before loading routes that use RedisStore).
 */
async function ensureRedis() {
  if (process.env.NODE_ENV === "test") return;
  try {
    if (!client.isOpen) {
      await client.connect();
      logger.info("Redis connected");
    }
  } catch (err) {
    logger.warn("Redis unavailable — response caching and Redis-backed rate limits disabled", {
      message: err.message
    });
  }
}

module.exports = client;
module.exports.ensureRedis = ensureRedis;
