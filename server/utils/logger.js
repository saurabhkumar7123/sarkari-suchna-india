const path = require("path");
const fs = require("fs");
const winston = require("winston");

const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, errors } = winston.format;
const isProd = process.env.NODE_ENV === "production";

const fileLineFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return stack ? `${ts} [${level}] ${message}\n${stack}` : `${ts} [${level}] ${message}${extra}`;
});

const defaultLevel = process.env.LOG_LEVEL || (isProd ? "warn" : "debug");

const logger = winston.createLogger({
  level: defaultLevel,
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), fileLineFormat),
  defaultMeta: { service: "sarkari-suchna" },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      level: isProd ? "warn" : "info",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

if (!isProd) {
  logger.add(
    new winston.transports.Console({
      format: combine(
        winston.format.colorize(),
        printf(({ level, message, timestamp: ts, stack }) =>
          stack ? `${ts} ${level}: ${message}\n${stack}` : `${ts} ${level}: ${message}`
        )
      )
    })
  );
}

const accessLogger = winston.createLogger({
  level: "http",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), fileLineFormat),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "access.log"),
      maxsize: isProd ? 5 * 1024 * 1024 : 10 * 1024 * 1024,
      maxFiles: isProd ? 3 : 7
    })
  ]
});

if (!isProd) {
  accessLogger.add(
    new winston.transports.Console({
      format: printf(({ message, timestamp: ts }) => `${ts} [access] ${message}`)
    })
  );
}

logger.logError = (msg) => {
  logger.error(msg);
};

logger.routeInfo = (message, meta = {}) => {
  const payload = {
    route: meta.route || "",
    status: meta.status || 200,
    message: meta.message || message
  };
  logger.info(message, payload);
};

logger.routeError = (message, meta = {}) => {
  const payload = {
    route: meta.route || "",
    status: meta.status || 500,
    message: meta.message || message
  };
  logger.error(message, payload);
};

module.exports = logger;
module.exports.accessLogger = accessLogger;
