import { browserTracingIntegration, spanToJSON, startBrowserTracingNavigationSpan, getActiveSpan, getRootSpan } from '@sentry/browser';
import { SEMANTIC_ATTRIBUTE_SENTRY_SOURCE, getClient, SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN, SEMANTIC_ATTRIBUTE_SENTRY_OP } from '@sentry/core';
import { useBeforeLeave, useLocation } from '@solidjs/router';
import { splitProps, createComponent, mergeProps, createEffect } from 'solid-js';

const CLIENTS_WITH_INSTRUMENT_NAVIGATION = new WeakSet();

function handleNavigation(location) {
  const client = getClient();
  if (!client || !CLIENTS_WITH_INSTRUMENT_NAVIGATION.has(client)) {
    return;
  }

  // The solid router integration will be used for both solid and solid start.
  // To avoid increasing the api surface with internal properties, we look at
  // the sdk metadata.
  const metaData = client.getSdkMetadata();
  const { name } = metaData?.sdk || {};
  const framework = name?.includes('solidstart') ? 'solidstart' : 'solid';

  startBrowserTracingNavigationSpan(client, {
    name: location,
    attributes: {
      [SEMANTIC_ATTRIBUTE_SENTRY_OP]: 'navigation',
      [SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: `auto.navigation.${framework}.solidrouter`,
      [SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: 'url',
    },
  });
}

function getActiveRootSpan() {
  const span = getActiveSpan();
  return span ? getRootSpan(span) : undefined;
}

/** Pass-through component in case user didn't specify a root **/
function SentryDefaultRoot(props) {
  return props.children;
}

/**
 * Unfortunately, we cannot use router hooks directly in the Router, so we
 * need to wrap the `root` prop to instrument navigation.
 */
function withSentryRouterRoot(Root) {
  const SentryRouterRoot = (props) => {
    // TODO: This is a rudimentary first version of handling navigation spans
    // It does not
    // - use query params
    // - parameterize the route

    useBeforeLeave(({ to }) => {
      // `to` could be `-1` if the browser back-button was used
      handleNavigation(to.toString());
    });

    const location = useLocation();
    createEffect(() => {
      const name = location.pathname;
      const rootSpan = getActiveRootSpan();

      if (rootSpan) {
        const { op, description } = spanToJSON(rootSpan);

        // We only need to update navigation spans that have been created by
        // a browser back-button navigation (stored as `-1` by solid router)
        // everything else was already instrumented correctly in `useBeforeLeave`
        if (op === 'navigation' && description === '-1') {
          rootSpan.updateName(name);
          rootSpan.setAttribute(SEMANTIC_ATTRIBUTE_SENTRY_SOURCE, 'url');
        }
      }
    });

    return createComponent(Root, props);
  };

  return SentryRouterRoot;
}

/**
 * A browser tracing integration that uses Solid Router to instrument navigations.
 */
function solidRouterBrowserTracingIntegration(
  options = {},
) {
  const integration = browserTracingIntegration({
    ...options,
    instrumentNavigation: false,
  });

  const { instrumentNavigation = true } = options;

  return {
    ...integration,
    afterAllSetup(client) {
      integration.afterAllSetup(client);

      if (instrumentNavigation) {
        CLIENTS_WITH_INSTRUMENT_NAVIGATION.add(client);
      }
    },
  };
}

/**
 * A higher-order component to instrument Solid Router to create navigation spans.
 */
function withSentryRouterRouting(Router) {
  const SentryRouter = (props) => {
    const [local, others] = splitProps(props, ['root']);
    // We need to wrap root here in case the user passed in their own root
    const Root = withSentryRouterRoot(local.root ? local.root : SentryDefaultRoot);

    return createComponent(Router, mergeProps({ root: Root }, others));
  };

  return SentryRouter;
}

export { solidRouterBrowserTracingIntegration, withSentryRouterRouting };
//# sourceMappingURL=solidrouter.js.map
