import { Accessor } from 'solid-js';

/** Trigger a re-render when reading signal properties of an object. */
declare function useDeepSignal<T extends object | null | undefined>(target: Accessor<T>): Accessor<T>;

export { useDeepSignal };
