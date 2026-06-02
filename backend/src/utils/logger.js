export const logger = {
  info(message, context = {}) {
    console.log(JSON.stringify({ level: "info", message, ...context, at: new Date().toISOString() }));
  },
  warn(message, context = {}) {
    console.warn(JSON.stringify({ level: "warn", message, ...context, at: new Date().toISOString() }));
  },
  error(message, context = {}) {
    console.error(JSON.stringify({ level: "error", message, ...context, at: new Date().toISOString() }));
  }
};
