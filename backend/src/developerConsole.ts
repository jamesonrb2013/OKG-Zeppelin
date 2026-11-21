import { inspect } from "util";
import { redis } from "./data/redis.js";

export type DeveloperLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export interface DeveloperLogEntry {
  id: string;
  timestamp: string;
  level: DeveloperLogLevel;
  source: string;
  message: string;
}

const LOG_KEY = "okg:developer:logs";
const LOG_LIMIT = 1000;
let sequence = 0;
let installed = false;

function redact(value: string): string {
  return value
    .replace(/((?:bot[_ -]?token|token|password|secret|api[_ -]?key|authorization)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/\b(?:mfa\.[\w-]{20,}|[A-Za-z\d_-]{24}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{20,})\b/g, "[REDACTED_DISCORD_TOKEN]");
}

function formatArguments(args: unknown[]): string {
  return redact(args.map((arg) => {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    return inspect(arg, { depth: 5, colors: false, breakLength: Infinity, maxArrayLength: 100 });
  }).join(" "));
}

function persist(entry: DeveloperLogEntry) {
  void redis.lPush(LOG_KEY, JSON.stringify(entry))
    .then(() => redis.lTrim(LOG_KEY, 0, LOG_LIMIT - 1))
    .catch(() => undefined);
}

export function installDeveloperConsole(source: "bot" | "api") {
  if (!installed) {
    installed = true;
    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      trace: console.trace.bind(console),
      dir: console.dir.bind(console),
    };
    const record = (level: DeveloperLogLevel, args: unknown[]) => persist({
      id: `${Date.now()}-${++sequence}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message: formatArguments(args),
    });
    console.log = ((...args: unknown[]) => { original.log(...args); record("INFO", args); }) as typeof console.log;
    console.info = ((...args: unknown[]) => { original.info(...args); record("INFO", args); }) as typeof console.info;
    console.warn = ((...args: unknown[]) => { original.warn(...args); record("WARN", args); }) as typeof console.warn;
    console.error = ((...args: unknown[]) => { original.error(...args); record("ERROR", args); }) as typeof console.error;
    console.debug = ((...args: unknown[]) => { original.debug(...args); record("DEBUG", args); }) as typeof console.debug;
    console.trace = ((...args: unknown[]) => { original.trace(...args); record("DEBUG", args); }) as typeof console.trace;
    console.dir = ((...args: unknown[]) => { original.dir(...args); record("DEBUG", args); }) as typeof console.dir;
  }

  const heartbeatKey = `okg:developer:heartbeat:${source}`;
  const beat = () => { void redis.set(heartbeatKey, String(Date.now()), { EX: 45 }).catch(() => undefined); };
  beat();
  const timer = setInterval(beat, 15_000);
  timer.unref?.();
}
