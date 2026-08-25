import { init as init$1 } from '@sentry/browser';
import { applySdkMetadata } from '@sentry/core';

/**
 * Initializes the Solid SDK
 */
function init(options) {
  const opts = {
    ...options,
  };

  applySdkMetadata(opts, 'solid');

  return init$1(opts);
}

export { init };
//# sourceMappingURL=sdk.js.map
