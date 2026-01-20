"use client"

import { useEffect, useMemo, useState } from "react"
import { DateTime } from "luxon"
import {
  normalizeIntervals,
  subtractIntervals,
  unionIntervals,
  type Interval,
} from "@/lib/availability/intervals"
import {
  minutesFromTimeString,
  timeStringFromMinutes,
  toUtcIsoFromLocal,
  overrideToLocalIntervalForDate,
} from "@/lib/availability/time"

type WindowDTO = { dayOfWeek: number; startMinute: number; endMinute: number }
type OverrideDTO = {
  id: string
  startAt: string
  endAt: string
  kind: "AVAILABLE" | "UNAVAILABLE"
  note?: string | null
}

const DAYS: { dayOfWeek: number; label: string }[] = [
  { dayOfWeek: 1, label: "Mon" },
  { dayOfWeek: 2, label: "Tue" },
  { dayOfWeek: 3, label: "Wed" },
  { dayOfWeek: 4, label: "Thu" },
  { dayOfWeek: 5, label: "Fri" },
  { dayOfWeek: 6, label: "Sat" },
  { dayOfWeek: 7, label: "Sun" },
]

export default function AvailabilityClient({ orgId }: { orgId: string }) {
  const detectedTZ = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", [])

  const [timeZone, setTimeZone] = useState<string>(detectedTZ)
  const [windows, setWindows] = useState<WindowDTO[]>([])
  const [overrides, setOverrides] = useState<OverrideDTO[]>([])
  const [status, setStatus] = useState<string>("")

  const [previewDate, setPreviewDate] = useState<string>(() => DateTime.now().toISODate()!)

  const [ovDate, setOvDate] = useState<string>(() => DateTime.now().toISODate()!)
  const [ovStart, setOvStart] = useState<string>("09:00")
  const [ovEnd, setOvEnd] = useState<string>("10:00")
  const [ovKind, setOvKind] = useState<"AVAILABLE" | "UNAVAILABLE">("UNAVAILABLE")
  const [ovNote, setOvNote] = useState<string>("")

  useEffect(() => {
    ;(async () => {
      setStatus("Loading…")
      const [tRes, oRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/availability/me/template`, { cache: "no-store" }),
        fetch(`/api/orgs/${orgId}/availability/me/overrides`, { cache: "no-store" }),
      ])

      if (tRes.ok) {
        const t = await tRes.json()
        setTimeZone(t.timeZone || detectedTZ)
        setWindows(t.windows || [])
      }

      if (oRes.ok) {
        const o = await oRes.json()
        setOverrides(o.overrides || [])
      }

      setStatus("")
    })()
  }, [orgId, detectedTZ])

  function addWindow(dayOfWeek: number) {
    setWindows((w) => [...w, { dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 }])
  }

  function updateWindow(idx: number, patch: Partial<WindowDTO>) {
    setWindows((w) => w.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  function deleteWindow(idx: number) {
    setWindows((w) => w.filter((_, i) => i !== idx))
  }

  async function saveTemplate() {
    setStatus("Saving…")
    const res = await fetch(`/api/orgs/${orgId}/availability/me/template`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone, windows }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setStatus(`Save failed: ${err?.error ?? res.status}`)
      return
    }

    const updated = await res.json()
    setTimeZone(updated.timeZone)
    setWindows(updated.windows)
    setStatus("Saved")
    setTimeout(() => setStatus(""), 1200)
  }

  async function createOverride() {
    setStatus("Creating override…")

    const startAt = toUtcIsoFromLocal(ovDate, ovStart, timeZone)
    const endAt = toUtcIsoFromLocal(ovDate, ovEnd, timeZone)

    const res = await fetch(`/api/orgs/${orgId}/availability/me/overrides`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startAt,
        endAt,
        kind: ovKind,
        note: ovNote.trim() ? ovNote.trim() : undefined,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setStatus(`Create failed: ${err?.error ?? res.status}`)
      return
    }

    const json = await res.json()
    setOverrides((o) => [...o, json.override].sort((a, b) => a.startAt.localeCompare(b.startAt)))
    setStatus("Override created")
    setTimeout(() => setStatus(""), 1200)
  }

  async function deleteOverride(id: string) {
    setStatus("Deleting override…")
    const res = await fetch(`/api/orgs/${orgId}/availability/me/overrides/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setStatus(`Delete failed: ${res.status}`)
      return
    }
    setOverrides((o) => o.filter((x) => x.id !== id))
    setStatus("")
  }

  const effectiveForPreview = useMemo(() => {
    const dt = DateTime.fromISO(previewDate, { zone: timeZone })
    const weekday = dt.weekday

    const base = normalizeIntervals(
      windows
        .filter((w) => w.dayOfWeek === weekday)
        .map((w) => ({ start: w.startMinute, end: w.endMinute })),
    )

    let current: Interval[] = base

    for (const ov of overrides) {
      const local = overrideToLocalIntervalForDate(ov, previewDate, timeZone)
      if (!local) continue

      if (ov.kind === "UNAVAILABLE") current = subtractIntervals(current, [local])
      else current = unionIntervals(current, [local])
    }

    return current
  }, [previewDate, timeZone, windows, overrides])

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
      {status ? (
        <div>
          <em>{status}</em>
        </div>
      ) : null}

      <section style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
        <h2>Weekly template</h2>

        <label style={{ display: "block", marginBottom: 8 }}>
          Time zone:&nbsp;
          <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} style={{ width: 260 }} />
          <span style={{ marginLeft: 8, opacity: 0.7 }}>(IANA, e.g. America/New_York)</span>
        </label>

        <div style={{ display: "grid", gap: 12 }}>
          {DAYS.map((d) => {
            const dayWindows = windows
              .map((w, idx) => ({ ...w, idx }))
              .filter((w) => w.dayOfWeek === d.dayOfWeek)
              .sort((a, b) => a.startMinute - b.startMinute)

            return (
              <div
                key={d.dayOfWeek}
                style={{ padding: 8, border: "1px solid #444", borderRadius: 8 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{d.label}</strong>
                  <button type="button" onClick={() => addWindow(d.dayOfWeek)}>
                    + Add window
                  </button>
                </div>

                {dayWindows.length === 0 ? (
                  <div style={{ opacity: 0.7, marginTop: 6 }}>No windows</div>
                ) : (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {dayWindows.map((w) => (
                      <div key={w.idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="time"
                          value={timeStringFromMinutes(w.startMinute)}
                          onChange={(e) =>
                            updateWindow(w.idx, {
                              startMinute: minutesFromTimeString(e.target.value),
                            })
                          }
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={timeStringFromMinutes(w.endMinute)}
                          onChange={(e) =>
                            updateWindow(w.idx, {
                              endMinute: minutesFromTimeString(e.target.value),
                            })
                          }
                        />
                        <button type="button" onClick={() => deleteWindow(w.idx)}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button type="button" onClick={saveTemplate}>
            Save template
          </button>
        </div>
      </section>

      <section style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
        <h2>Overrides</h2>

        <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <label>
            Date:&nbsp;
            <input type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
          </label>
          <label>
            Start:&nbsp;
            <input type="time" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
          </label>
          <label>
            End:&nbsp;
            <input type="time" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
          </label>
          <label>
            Kind:&nbsp;
            <select value={ovKind} onChange={(e) => setOvKind(e.target.value as "AVAILABLE" | "UNAVAILABLE")}>
              <option value="UNAVAILABLE">UNAVAILABLE (subtract)</option>
              <option value="AVAILABLE">AVAILABLE (add)</option>
            </select>
          </label>
          <label>
            Note (optional):&nbsp;
            <input value={ovNote} onChange={(e) => setOvNote(e.target.value)} />
          </label>
          <button type="button" onClick={createOverride}>
            Create override
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {overrides.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No overrides yet</div>
          ) : (
            <ul>
              {overrides.map((o) => (
                <li key={o.id}>
                  <code>{o.kind}</code> {o.startAt} → {o.endAt} {o.note ? `(${o.note})` : ""}
                  &nbsp;<button type="button" onClick={() => deleteOverride(o.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
        <h2>Effective availability preview</h2>
        <label>
          Date:&nbsp;
          <input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} />
        </label>

        <div style={{ marginTop: 8 }}>
          {effectiveForPreview.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No availability</div>
          ) : (
            <ul>
              {effectiveForPreview.map((i, idx) => (
                <li key={idx}>
                  {timeStringFromMinutes(i.start)} – {timeStringFromMinutes(i.end)} ({timeZone})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
