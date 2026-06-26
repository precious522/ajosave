import pino from "pino";
import { getCorrelationId } from "./correlation";

const base = pino(
  { level: process.env.LOG_LEVEL ?? "info" },
  process.env.NODE_ENV !== "production"
    ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined
);

// Proxy that injects correlationId from AsyncLocalStorage on every log call
const logger = new Proxy(base, {
  get(target, prop) {
    const val = (target as any)[prop];
    if (typeof val !== "function") return val;
    if (!["trace", "debug", "info", "warn", "error", "fatal"].includes(prop as string)) {
      return val.bind(target);
    }
    return (...args: unknown[]) => {
      const correlationId = getCorrelationId();
      if (!correlationId) return (val as Function).apply(target, args);
      // pino log methods: (obj, msg) or (msg)
      if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
        args[0] = { correlationId, ...(args[0] as object) };
      } else {
        args = [{ correlationId }, ...args];
      }
      return (val as Function).apply(target, args);
    };
  },
});

export default logger;
