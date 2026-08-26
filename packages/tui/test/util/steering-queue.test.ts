import { expect, test } from "bun:test"
import { pendingPrompts, steeringFlow } from "../../src/prompt/steering-queue"

// Unique session IDs per test keep the module-level queue isolated.
const sid = () => `ses_${crypto.randomUUID()}`

test("queue is FIFO per session and sessions stay isolated", () => {
  const a = sid()
  const b = sid()
  pendingPrompts.add({ sessionID: a, kind: "followup", input: "first", parts: [] })
  pendingPrompts.add({ sessionID: a, kind: "next", input: "second", parts: [] })
  pendingPrompts.add({ sessionID: b, kind: "followup", input: "other", parts: [] })

  expect(pendingPrompts.list(a).map((item) => item.input)).toEqual(["first", "second"])
  const taken = pendingPrompts.take(a)
  expect(taken?.input).toBe("first")
  expect(pendingPrompts.list(a).map((item) => item.input)).toEqual(["second"])
  expect(pendingPrompts.list(b).map((item) => item.input)).toEqual(["other"])
  for (const item of [...pendingPrompts.list(a), ...pendingPrompts.list(b)]) pendingPrompts.remove(item.id)
})

test("remove drops only the targeted entry and take on empty returns undefined", () => {
  const a = sid()
  const first = pendingPrompts.add({ sessionID: a, kind: "followup", input: "keep me editable", parts: [] })
  pendingPrompts.add({ sessionID: a, kind: "followup", input: "drop me", parts: [] })
  pendingPrompts.remove(
    pendingPrompts.list(a).find((item) => item.input === "drop me")!.id,
  )
  expect(pendingPrompts.list(a).length).toBe(1)
  expect(pendingPrompts.list(a).some((item) => item.id === first)).toBe(true)
  pendingPrompts.remove(first)
  expect(pendingPrompts.list(a).length).toBe(0)
  expect(pendingPrompts.take(a)).toBeUndefined()
})

test("dispatch latch prevents double dispatch until busy is observed", () => {
  const a = sid()
  expect(steeringFlow.shouldDispatch(a)).toBe(true)
  steeringFlow.mark(a)
  expect(steeringFlow.shouldDispatch(a)).toBe(false)
  steeringFlow.settle(a)
  expect(steeringFlow.shouldDispatch(a)).toBe(true)
})

test("queued entries carry the full prompt payload intact", () => {
  const a = sid()
  const parts = [{ type: "file" as const, mime: "text/plain", filename: "note.txt" }] as any
  pendingPrompts.add({ sessionID: a, kind: "next", input: "run checks\nwith detail", parts })
  const [item] = pendingPrompts.list(a)
  expect(item.kind).toBe("next")
  expect(item.input).toBe("run checks\nwith detail")
  expect(item.parts).toEqual(parts)
  pendingPrompts.remove(item.id)
})
