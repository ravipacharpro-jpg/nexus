Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const browser = require('@sentry/browser');
const sdk = require('./sdk.js');
const errorboundary = require('./errorboundary.js');



exports.init = sdk.init;
exports.withSentryErrorBoundary = errorboundary.withSentryErrorBoundary;
Object.prototype.hasOwnProperty.call(browser, '__proto__') &&
	!Object.prototype.hasOwnProperty.call(exports, '__proto__') &&
	Object.defineProperty(exports, '__proto__', {
		enumerable: true,
		value: browser['__proto__']
	});

Object.keys(browser).forEach(k => {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) exports[k] = browser[k];
});
//# sourceMappingURL=index.js.map
