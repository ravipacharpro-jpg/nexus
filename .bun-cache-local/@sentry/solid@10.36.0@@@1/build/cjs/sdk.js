Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const browser = require('@sentry/browser');
const core = require('@sentry/core');

/**
 * Initializes the Solid SDK
 */
function init(options) {
  const opts = {
    ...options,
  };

  core.applySdkMetadata(opts, 'solid');

  return browser.init(opts);
}

exports.init = init;
//# sourceMappingURL=sdk.js.map
