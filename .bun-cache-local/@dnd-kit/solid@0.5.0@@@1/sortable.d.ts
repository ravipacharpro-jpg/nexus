import * as solid_js from 'solid-js';
import { Data } from '@dnd-kit/abstract';
import { SortableInput, Sortable } from '@dnd-kit/dom/sortable';
export { isSortable, isSortableOperation } from '@dnd-kit/dom/sortable';

interface UseSortableInput<T extends Data = Data> extends Omit<SortableInput<T>, 'handle' | 'element' | 'source' | 'target'> {
    handle?: Element;
    element?: Element;
    source?: Element;
    target?: Element;
}
declare function useSortable<T extends Data = Data>(input: UseSortableInput<T>): {
    readonly sortable: Sortable<T>;
    isDragging: () => boolean;
    isDropping: () => boolean;
    isDragSource: () => boolean;
    isDropTarget: () => boolean;
    ref: solid_js.Setter<Element | undefined>;
    handleRef: solid_js.Setter<Element | undefined>;
    sourceRef: solid_js.Setter<Element | undefined>;
    targetRef: solid_js.Setter<Element | undefined>;
};

export { type UseSortableInput, useSortable };
