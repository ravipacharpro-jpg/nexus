Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const browser = require('@sentry/browser');
const core = require('@sentry/core');
const router = require('@solidjs/router');
const solidJs = require('solid-js');

const CLIENTS_WITH_INSTRUMENT_NAVIGATION = new WeakSet();

function handleNavigation(location) {
  const client = core.getClient();
  if (!client || !CLIENTS_WITH_INSTRUMENT_NAVIGATION.has(client)) {
    return;
  }

  // The solid router integration will be used for both solid and solid start.
  // To avoid increasing the api surface with internal properties, we look at
  // the sdk metadata.
  const metaData = client.getSdkMetadata();
  const { name } = metaData?.sdk || {};
  const framework = name?.includes('solidstart') ? 'solidstart' : 'solid';

  browser.startBrowserTracingNavigationSpan(client, {
    name: location,
    attributes: {
      [core.SEMANTIC_ATTRIBUTE_SENTRY_OP]: 'navigation',
      [core.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: `auto.navigation.${framework}.solidrouter`,
      [core.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: 'url',
    },
  });
}

function getActiveRootSpan() {
  const span = browser.getActiveSpan();
  return span ? browser.getRootSpan(span) : undefined;
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

    router.useBeforeLeave(({ to }) => {
      // `to` could be `-1` if the browser back-button was used
      handleNavigation(to.toString());
    });

    const location = router.useLocation();
    solidJs.createEffect(() => {
      const name = location.pathname;
      const rootSpan = getActiveRootSpan();

      if (rootSpan) {
        const { op, description } = browser.spanToJSON(rootSpan);

        // We only need to update navigation spans that have been created by
        // a browser back-button navigation (stored as `-1` by solid router)
        // everything else was already instrumented correctly in `useBeforeLeave`
        if (op === 'navigation' && description === '-1') {
          rootSpan.updateName(name);
          rootSpan.setAttribute(core.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE, 'url');
        }
      }
    });

    return solidJs.createComponent(Root, props);
  };

  return SentryRouterRoot;
}

/**
 * A browser tracing integration that uses Solid Router to instrument navigations.
 */
function solidRouterBrowserTracingIntegration(
  options = {},
) {
  const integration = browser.browserTracingIntegration({
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
    const [local, others] = solidJs.splitProps(props, ['root']);
    // We need to wrap root here in case the user passed in their own root
    const Root = withSentryRouterRoot(local.root ? local.root : SentryDefaultRoot);

    return solidJs.createComponent(Router, solidJs.mergeProps({ root: Root }, others));
  };

  return SentryRouter;
}

exports.solidRouterBrowserTracingIntegration = solidRouterBrowserTracingIntegration;
exports.withSentryRouterRouting = withSentryRouterRouting;
//# sourceMappingURL=solidrouter.js.map
