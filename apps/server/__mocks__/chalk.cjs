// CJS mock for chalk (ESM-only) used in Jest environment
const fn = (s) => (typeof s === 'string' ? s : (s?.[0] ?? ''));
const handler = {
  get: () => new Proxy(fn, handler),
  apply: (_t, _th, args) => (typeof args[0] === 'string' ? args[0] : (args[0]?.[0] ?? '')),
};
const chalk = new Proxy(fn, handler);
module.exports = chalk;
module.exports.default = chalk;
