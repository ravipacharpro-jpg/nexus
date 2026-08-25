'use strict';

// src/utilities/saveElementPosition.ts
function createSaveElementPosition() {
  let savedPosition = null;
  const savePosition = (source) => {
    const element = source.element;
    const id = source.id;
    const prevElement = element.previousElementSibling;
    const nextElement = element.nextElementSibling;
    const parentElement = element.parentElement;
    savedPosition = {
      id,
      element,
      prevElement: prevElement === element ? null : prevElement,
      nextElement: nextElement === element ? null : nextElement,
      parentElement
    };
  };
  const restorePosition = (element) => {
    if (!savedPosition) return;
    const { prevElement, nextElement, parentElement } = savedPosition;
    if (prevElement && element.previousElementSibling !== prevElement) {
      prevElement.insertAdjacentElement("afterend", element);
    } else if (nextElement && element.nextElementSibling !== nextElement) {
      nextElement.insertAdjacentElement("beforebegin", element);
    } else if (!prevElement && !nextElement && parentElement) {
      parentElement.appendChild(element);
    }
  };
  const clearPosition = () => {
    savedPosition = null;
  };
  return {
    savePosition,
    clearPosition,
    restorePosition
  };
}

exports.createSaveElementPosition = createSaveElementPosition;
//# sourceMappingURL=utilities.cjs.map
//# sourceMappingURL=utilities.cjs.map