Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const browser = require('@sentry/browser');
const solidJs = require('solid-js');

/**
 * A higher-order component to wrap Solid's ErrorBoundary to capture exceptions.
 */
function withSentryErrorBoundary(ErrorBoundary) {
  const SentryErrorBoundary = (props) => {
    const [local, others] = solidJs.splitProps(props, ['fallback']);

    const fallback = (error, reset) => {
      browser.captureException(error, {
        mechanism: {
          handled: true, // handled because user has to provide a fallback
          type: 'auto.function.solid.error_boundary',
        },
      });

      const f = local.fallback;
      return typeof f === 'function' ? f(error, reset) : f;
    };

    return solidJs.createComponent(ErrorBoundary, solidJs.mergeProps({ fallback }, others));
  };

  return SentryErrorBoundary;
}

exports.withSentryErrorBoundary = withSentryErrorBoundary;
//# sourceMappingURL=errorboundary.js.map
