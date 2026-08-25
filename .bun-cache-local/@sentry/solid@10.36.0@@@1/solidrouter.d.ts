import { browserTracingIntegration } from '@sentry/browser';
import type { Integration } from '@sentry/core';
import type { HashRouter, MemoryRouter, Router as BaseRouter, StaticRouter } from '@solidjs/router';
/**
 * A browser tracing integration that uses Solid Router to instrument navigations.
 */
export declare function solidRouterBrowserTracingIntegration(options?: Parameters<typeof browserTracingIntegration>[0]): Integration;
type RouterType = typeof BaseRouter | typeof HashRouter | typeof MemoryRouter | typeof StaticRouter;
/**
 * A higher-order component to instrument Solid Router to create navigation spans.
 */
export declare function withSentryRouterRouting(Router: RouterType): RouterType;
export {};
//# sourceMappingURL=solidrouter.d.ts.map