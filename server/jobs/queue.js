const { Queue } = require("bullmq");

const queue = new Queue("jobs", {
  connection: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379)
  }
});

module.exports = queue;