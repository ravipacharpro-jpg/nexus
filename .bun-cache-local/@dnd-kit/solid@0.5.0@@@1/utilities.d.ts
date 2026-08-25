import { Draggable } from '@dnd-kit/dom';

declare function createSaveElementPosition(): {
    savePosition: (source: Draggable) => void;
    clearPosition: () => void;
    restorePosition: (element: Element) => void;
};

export { createSaveElementPosition };
