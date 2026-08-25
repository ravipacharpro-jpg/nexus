import * as solid_js from 'solid-js';
import { ParentProps, JSX, ValidComponent } from 'solid-js';
import * as _dnd_kit_dom from '@dnd-kit/dom';
import { DragDropManagerInput, DragDropManager, Draggable, Droppable, DraggableInput, DropAnimation, DroppableInput } from '@dnd-kit/dom';
export { DragDropManager, KeyboardSensor, PointerSensor } from '@dnd-kit/dom';
import * as _dnd_kit_abstract from '@dnd-kit/abstract';
import { DragDropEventHandlers, Data } from '@dnd-kit/abstract';
import { CleanupFunction } from '@dnd-kit/state';

type Events$1 = DragDropEventHandlers<Draggable, Droppable, DragDropManager>;
interface DragDropProviderProps extends DragDropManagerInput, ParentProps {
    manager?: DragDropManager;
    onBeforeDragStart?: Events$1['beforedragstart'];
    onCollision?: Events$1['collision'];
    onDragStart?: Events$1['dragstart'];
    onDragMove?: Events$1['dragmove'];
    onDragOver?: Events$1['dragover'];
    onDragEnd?: Events$1['dragend'];
}
declare function DragDropProvider(props: DragDropProviderProps): solid_js.JSX.Element;

interface UseDraggableInput<T extends Data = Data> extends Omit<DraggableInput<T>, 'handle' | 'element'> {
    handle?: Element;
    element?: Element;
}
declare function useDraggable<T extends Data = Data>(input: UseDraggableInput<T>): {
    readonly draggable: Draggable<T>;
    isDragging: () => boolean;
    isDropping: () => boolean;
    isDragSource: () => boolean;
    ref: solid_js.Setter<Element | undefined>;
    handleRef: solid_js.Setter<Element | undefined>;
};

interface DragOverlayProps<T extends Data, U extends Draggable<T>> {
    class?: string;
    children: JSX.Element | ((source: U) => JSX.Element);
    /**
     * Customize or disable the drop animation that plays when a drag operation ends.
     *
     * - `undefined` – use the default animation (250ms ease)
     * - `null` – disable the drop animation entirely
     * - `{duration, easing}` – customize the animation timing
     * - `(context) => Promise<void> | void` – provide a fully custom animation function
     */
    dropAnimation?: DropAnimation | null;
    style?: JSX.CSSProperties;
    tag?: ValidComponent;
    disabled?: boolean | ((source: U | null) => boolean);
}
declare function DragOverlay<T extends Data, U extends Draggable<T>>(props: DragOverlayProps<T, U>): JSX.Element;

interface UseDroppableInput<T extends Data = Data> extends Omit<DroppableInput<T>, 'element'> {
    element?: Element;
}
declare function useDroppable<T extends Data = Data>(input: UseDroppableInput<T>): {
    readonly droppable: Droppable<T>;
    isDropTarget: () => boolean;
    ref: solid_js.Setter<Element | undefined>;
};

declare function useDragDropManager(): _dnd_kit_dom.DragDropManager<_dnd_kit_abstract.Data, _dnd_kit_dom.Draggable<_dnd_kit_abstract.Data>, _dnd_kit_dom.Droppable<_dnd_kit_abstract.Data>> | null;

type EventNameOverrides = {
    beforedragstart: 'onBeforeDragStart';
};
type EventHandlerName<T extends string> = T extends keyof EventNameOverrides ? EventNameOverrides[T] : T extends `drag${infer Second}${infer Rest}` ? `onDrag${Uppercase<Second>}${Rest}` : `on${Capitalize<T>}`;
type Events<T extends Data, U extends Draggable<T>, V extends Droppable<T>, W extends DragDropManager<T, U, V>> = DragDropEventHandlers<U, V, W>;
type EventHandlers<T extends Data = Data, U extends Draggable<T> = Draggable<T>, V extends Droppable<T> = Droppable<T>, W extends DragDropManager<T, U, V> = DragDropManager<T, U, V>> = {
    [K in keyof Events<T, U, V, W> as EventHandlerName<K>]?: Events<T, U, V, W>[K];
};
declare function useDragDropMonitor<T extends Data = Data, U extends Draggable<T> = Draggable<T>, V extends Droppable<T> = Droppable<T>, W extends DragDropManager<T, U, V> = DragDropManager<T, U, V>>(handlers: EventHandlers<T, U, V, W>): void;

declare function useDragOperation(): {
    source: () => _dnd_kit_dom.Draggable<_dnd_kit_abstract.Data> | null | undefined;
    target: () => _dnd_kit_dom.Droppable<_dnd_kit_abstract.Data> | null | undefined;
    status: () => _dnd_kit_abstract.DragOperationStatus | undefined;
};

interface Instance<T extends DragDropManager = DragDropManager> {
    manager: T | undefined;
    register(): CleanupFunction | void;
}
declare function useInstance<T extends Instance>(initializer: (manager: DragDropManager | undefined) => T): T;

export { type EventHandlers as DragDropEventHandlers, DragDropProvider, type DragDropProviderProps, DragOverlay, type UseDraggableInput, type UseDroppableInput, useDragDropManager, useDragDropMonitor, useDragOperation, useDraggable, useDroppable, useInstance };
