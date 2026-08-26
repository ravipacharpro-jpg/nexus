import { createStore, produce } from "solid-js/store"
import type { PromptInfo } from "./history"

/**
 * In-memory pending queue for messages typed while a task is active. Entries
 * are visible, editable, and removable from the session timeline and are
 * dispatched FIFO through the normal prompt path when the session becomes
 * idle. The queue is intentionally not persisted: after a restart nothing is
 * silently resumed or redispatched.
 */

export type PendingPrompt = PromptInfo & {
  id: string
  sessionID: string
  /** "next" items dispatch right after an explicit cancellation; "followup" items wait for the active turn to finish. */
  kind: "next" | "followup"
}

const [store, setStore] = createStore<{ items: PendingPrompt[] }>({ items: [] })

// Per-session latch: set when an item is dispatched so a lagging idle status
// event cannot double-dispatch; cleared once the session is seen busy again.
const expectingBusy = new Map<string, boolean>()

export const pendingPrompts = {
  list: (sessionID: string) => store.items.filter((item) => item.sessionID === sessionID),
  add(item: Omit<PendingPrompt, "id">) {
    const entry: PendingPrompt = { ...item, id: crypto.randomUUID() }
    setStore("items", produce((items) => items.push(entry)))
    return entry.id
  },
  remove(id: string) {
    setStore(
      "items",
      produce((items) => {
        const index = items.findIndex((item) => item.id === id)
        if (index !== -1) items.splice(index, 1)
      }),
    )
  },
  /** Takes the oldest item for a session that became idle. */
  take(sessionID: string): PendingPrompt | undefined {
    let taken: PendingPrompt | undefined
    setStore(
      "items",
      produce((items) => {
        const index = items.findIndex((item) => item.sessionID === sessionID)
        if (index !== -1) taken = items.splice(index, 1)[0]
      }),
    )
    return taken
  },
}

export const steeringFlow = {
  /** Marks a session as having just dispatched an item. */
  mark(sessionID: string) {
    expectingBusy.set(sessionID, true)
  },
  /** Clears the latch once the session is observed busy (or leaves idle state). */
  settle(sessionID: string) {
    expectingBusy.set(sessionID, false)
  },
  /** True when an idle transition may safely dispatch the next queued item. */
  shouldDispatch(sessionID: string) {
    return expectingBusy.get(sessionID) !== true
  },
}
