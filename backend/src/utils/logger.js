export const logger = {
  info(message, context = {}) {
    console.log(JSON.stringify({ level: "info", message, ...context, at: new Date().toISOString() }));
  },
  error(message, context = {}) {
    console.error(JSON.stringify({ level: "error", message, ...context, at: new Date().toISOString() }));
  }
};
