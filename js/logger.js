const LogLevel = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
};

const IS_PRODUCTION = false;
const DEFAULT_DEV_LOG_LEVEL = LogLevel.DEBUG;
const DEFAULT_PROD_LOG_LEVEL = LogLevel.ERROR;

let currentLogLevel = IS_PRODUCTION
  ? DEFAULT_PROD_LOG_LEVEL
  : DEFAULT_DEV_LOG_LEVEL;

function getTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
}

const logger = {
  LogLevel,

  setLogLevel: (level) => {
    currentLogLevel = level;
    if (!IS_PRODUCTION) {
      console.log(
        `[${getTimestamp()}] [LOGGER] Log level set to: ${Object.keys(
          LogLevel
        ).find((key) => LogLevel[key] === level)} (${level})`
      );
    }
  },

  getLogLevel: () => currentLogLevel,

  debug: (...args) => {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.debug(`[${getTimestamp()}] [DEBUG]`, ...args);
    }
  },

  info: (...args) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(`[${getTimestamp()}] [INFO]`, ...args);
    }
  },

  warn: (...args) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(`[${getTimestamp()}] [WARN]`, ...args);
    }
  },

  error: (...args) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(`[${getTimestamp()}] [ERROR]`, ...args);
    }
  },

  critical: (...args) => {
    console.error(`[${getTimestamp()}] [CRITICAL]`, ...args);
  },
};

logger.setLogLevel(currentLogLevel);
