const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null
});

const siteCheckQueue = new Queue("site-check-queue", {
  connection
});

const heavyTaskQueue = new Queue("heavy-task-queue", {
  connection
});

module.exports = {
  siteCheckQueue,
  heavyTaskQueue,
  queueConnection: connection
};
