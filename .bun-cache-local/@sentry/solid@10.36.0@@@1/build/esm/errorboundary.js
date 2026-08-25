import { captureException } from '@sentry/browser';
import { splitProps, createComponent, mergeProps } from 'solid-js';

/**
 * A higher-order component to wrap Solid's ErrorBoundary to capture exceptions.
 */
function withSentryErrorBoundary(ErrorBoundary) {
  const SentryErrorBoundary = (props) => {
    const [local, others] = splitProps(props, ['fallback']);

    const fallback = (error, reset) => {
      captureException(error, {
        mechanism: {
          handled: true, // handled because user has to provide a fallback
          type: 'auto.function.solid.error_boundary',
        },
      });

      const f = local.fallback;
      return typeof f === 'function' ? f(error, reset) : f;
    };

    return createComponent(ErrorBoundary, mergeProps({ fallback }, others));
  };

  return SentryErrorBoundary;
}

export { withSentryErrorBoundary };
//# sourceMappingURL=errorboundary.js.map
