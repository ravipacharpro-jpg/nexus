import type { Component, JSX } from 'solid-js';
type ErrorBoundaryProps = {
    fallback: JSX.Element | ((err: any, reset: () => void) => JSX.Element);
    children: JSX.Element;
};
/**
 * A higher-order component to wrap Solid's ErrorBoundary to capture exceptions.
 */
export declare function withSentryErrorBoundary(ErrorBoundary: Component<ErrorBoundaryProps>): Component<ErrorBoundaryProps>;
export {};
//# sourceMappingURL=errorboundary.d.ts.map