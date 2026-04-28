import pino from "pino";

const logger = pino(
  { level: process.env.LOG_LEVEL ?? "info" },
  process.env.NODE_ENV !== "production"
    ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined
);

export default logger;
