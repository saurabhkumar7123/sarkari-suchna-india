const os = require("os");
const redisClient = require("../../config/redis");

const SCHEDULER_LOCK_KEY = process.env.SCHEDULER_LOCK_KEY || "lock:update-scheduler";
const schedulerLockOwner = `${os.hostname()}:${process.pid}:${Date.now()}`;

async function getCurrentSchedulerLockOwner() {
  if (!redisClient || !redisClient.isOpen) return null;
  return redisClient.get(SCHEDULER_LOCK_KEY);
}

async function isCurrentNodeSchedulerLeader() {
  const currentOwner = await getCurrentSchedulerLockOwner();
  return currentOwner === schedulerLockOwner;
}

module.exports = {
  SCHEDULER_LOCK_KEY,
  schedulerLockOwner,
  getCurrentSchedulerLockOwner,
  isCurrentNodeSchedulerLeader
};
