'use strict';

var sortable = require('@dnd-kit/dom/sortable');
var state = require('@dnd-kit/state');
var solidJs = require('solid-js');
var hooks = require('@dnd-kit/solid/hooks');
var solid = require('@dnd-kit/solid');

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
function useSortable(input) {
  const transition = __spreadValues(__spreadValues({}, sortable.defaultSortableTransition), input.transition);
  const sortable$1 = solid.useInstance((manager) => {
    return new sortable.Sortable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        transition,
        element: input.element,
        handle: input.handle,
        target: input.target
      }),
      manager
    );
  });
  const trackedSortable = hooks.useDeepSignal(() => sortable$1);
  const [element, setElement] = solidJs.createSignal(
    input.element
  );
  const [handle, setHandle] = solidJs.createSignal(input.handle);
  const [source, setSource] = solidJs.createSignal(input.source);
  const [target, setTarget] = solidJs.createSignal(input.target);
  solidJs.createEffect(() => {
    var _a;
    const el = element();
    if (el) sortable$1.element = el;
    const h = handle();
    if (h) sortable$1.handle = h;
    const s = source();
    if (s) sortable$1.source = s;
    const t = target();
    if (t) sortable$1.target = t;
    sortable$1.id = input.id;
    sortable$1.disabled = (_a = input.disabled) != null ? _a : false;
    sortable$1.alignment = input.alignment;
    sortable$1.plugins = input.plugins;
    sortable$1.modifiers = input.modifiers;
    sortable$1.sensors = input.sensors;
    sortable$1.accept = input.accept;
    sortable$1.type = input.type;
    sortable$1.collisionPriority = input.collisionPriority;
    sortable$1.transition = input.transition ? __spreadValues(__spreadValues({}, sortable.defaultSortableTransition), input.transition) : sortable.defaultSortableTransition;
    if (input.collisionDetector) {
      sortable$1.collisionDetector = input.collisionDetector;
    }
    if (input.data) {
      sortable$1.data = input.data;
    }
  });
  solidJs.createEffect(
    solidJs.on(
      () => [input.group, input.index],
      () => {
        state.batch(() => {
          sortable$1.group = input.group;
          sortable$1.index = input.index;
        });
      }
    )
  );
  solidJs.createEffect(
    solidJs.on(
      () => input.index,
      () => {
        var _a, _b;
        if (((_a = sortable$1.manager) == null ? void 0 : _a.dragOperation.status.idle) && ((_b = sortable$1.transition) == null ? void 0 : _b.idle)) {
          sortable$1.refreshShape();
        }
      }
    )
  );
  return {
    get sortable() {
      return sortable$1;
    },
    isDragging: () => trackedSortable().isDragging,
    isDropping: () => trackedSortable().isDropping,
    isDragSource: () => trackedSortable().isDragSource,
    isDropTarget: () => trackedSortable().isDropTarget,
    ref: setElement,
    handleRef: setHandle,
    sourceRef: setSource,
    targetRef: setTarget
  };
}

Object.defineProperty(exports, "isSortable", {
  enumerable: true,
  get: function () { return sortable.isSortable; }
});
Object.defineProperty(exports, "isSortableOperation", {
  enumerable: true,
  get: function () { return sortable.isSortableOperation; }
});
exports.useSortable = useSortable;
//# sourceMappingURL=sortable.cjs.map
//# sourceMappingURL=sortable.cjs.map