"use client"

import { useEffect, useMemo, useState } from "react"
import { DateTime } from "luxon"
import { toast } from "sonner"

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
import { ApiError, fetchJson } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WindowDTO = { dayOfWeek: number; startMinute: number; endMinute: number }
type OverrideDTO = {
  id: string
  startAt: string
  endAt: string
  kind: "AVAILABLE" | "UNAVAILABLE"
  note?: string | null
}

const DAYS = [
  { dayOfWeek: 1, label: "Mon" },
  { dayOfWeek: 2, label: "Tue" },
  { dayOfWeek: 3, label: "Wed" },
  { dayOfWeek: 4, label: "Thu" },
  { dayOfWeek: 5, label: "Fri" },
  { dayOfWeek: 6, label: "Sat" },
  { dayOfWeek: 7, label: "Sun" },
]

export default function AvailabilityClient({ orgId }: { orgId: string }) {
  const detectedTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  )

  const [timeZone, setTimeZone] = useState<string>(detectedTZ)
  const [windows, setWindows] = useState<WindowDTO[]>([])
  const [overrides, setOverrides] = useState<OverrideDTO[]>([])
  const [previewDate, setPreviewDate] = useState<string>(() => DateTime.now().toISODate()!)

  const [ovDate, setOvDate] = useState<string>(() => DateTime.now().toISODate()!)
  const [ovStart, setOvStart] = useState<string>("09:00")
  const [ovEnd, setOvEnd] = useState<string>("10:00")
  const [ovKind, setOvKind] = useState<"AVAILABLE" | "UNAVAILABLE">("UNAVAILABLE")
  const [ovNote, setOvNote] = useState<string>("")

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingOverride, setIsCreatingOverride] = useState(false)
  const [isDeletingOverride, setIsDeletingOverride] = useState(false)
  const [overrideToDelete, setOverrideToDelete] = useState<OverrideDTO | null>(null)

  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        const [template, overridesData] = await Promise.all([
          fetchJson<{ timeZone?: string; windows?: WindowDTO[] }>(
            `/api/orgs/${orgId}/availability/me/template`,
            { cache: "no-store" },
          ),
          fetchJson<{ overrides?: OverrideDTO[] }>(
            `/api/orgs/${orgId}/availability/me/overrides`,
            { cache: "no-store" },
          ),
        ])

        setTimeZone(template?.timeZone ?? detectedTZ)
        setWindows(template?.windows ?? [])
        setOverrides(overridesData?.overrides ?? [])
      } catch {
        toast.error("Unable to load availability data")
        setWindows([])
        setOverrides([])
      } finally {
        setIsLoading(false)
      }
    })()
  }, [detectedTZ, orgId])

  function addWindow(dayOfWeek: number) {
    setWindows((current) => [
      ...current,
      { dayOfWeek, startMinute: 9 * 60, endMinute: 17 * 60 },
    ])
  }

  function updateWindow(idx: number, patch: Partial<WindowDTO>) {
    setWindows((current) =>
      current.map((window, index) => (index === idx ? { ...window, ...patch } : window)),
    )
  }

  function deleteWindow(idx: number) {
    setWindows((current) => current.filter((_, index) => index !== idx))
  }

  async function saveTemplate() {
    setIsSaving(true)
    try {
      const updated = await fetchJson<{ timeZone: string; windows: WindowDTO[] }>(
        `/api/orgs/${orgId}/availability/me/template`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ timeZone, windows }),
        },
      )

      setTimeZone(updated.timeZone)
      setWindows(updated.windows)
      toast.success("Weekly template saved")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed"
      toast.error(`Save failed: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function createOverride() {
    setIsCreatingOverride(true)
    try {
      const startAt = toUtcIsoFromLocal(ovDate, ovStart, timeZone)
      const endAt = toUtcIsoFromLocal(ovDate, ovEnd, timeZone)

      const json = await fetchJson<{ override: OverrideDTO }>(
        `/api/orgs/${orgId}/availability/me/overrides`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startAt,
            endAt,
            kind: ovKind,
            note: ovNote.trim() ? ovNote.trim() : undefined,
          }),
        },
      )

      setOverrides((prev) =>
        [...prev, json.override].sort((a, b) => a.startAt.localeCompare(b.startAt)),
      )
      toast.success("Override added")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Create failed"
      toast.error(message)
    } finally {
      setIsCreatingOverride(false)
    }
  }

  async function deleteOverride(id: string) {
    setIsDeletingOverride(true)
    try {
      await fetchJson(`/api/orgs/${orgId}/availability/me/overrides/${id}`, {
        method: "DELETE",
      })
      setOverrides((current) => current.filter((override) => override.id !== id))
      toast.success("Override deleted")
      setOverrideToDelete(null)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed"
      toast.error(message)
    } finally {
      setIsDeletingOverride(false)
    }
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

    for (const override of overrides) {
      const local = overrideToLocalIntervalForDate(override, previewDate, timeZone)
      if (!local) continue

      if (override.kind === "UNAVAILABLE") current = subtractIntervals(current, [local])
      else current = unionIntervals(current, [local])
    }

    return current
  }, [overrides, previewDate, timeZone, windows])

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-border bg-background/70 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Weekly template</h2>
          <p className="text-sm text-muted-foreground">
            Configure the hours you are usually available and save a template for the team.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Time zone
            <Input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
          </label>

          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-3">
              <p className="text-sm text-muted-foreground">Loading windows…</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {DAYS.map((day) => {
                const dayWindows = windows
                  .map((win, idx) => ({ ...win, idx }))
                  .filter((win) => win.dayOfWeek === day.dayOfWeek)
                  .sort((a, b) => a.startMinute - b.startMinute)

                return (
                  <div
                    key={day.dayOfWeek}
                    className="rounded-2xl border border-border/70 bg-muted/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {day.label}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => addWindow(day.dayOfWeek)}
                      >
                        + Add window
                      </Button>
                    </div>

                    {dayWindows.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No windows yet.</p>
                    ) : (
                      <div className="mt-3 flex flex-col gap-3">
                        {dayWindows.map((win) => (
                          <div
                            key={win.idx}
                            className="flex flex-wrap items-center gap-3"
                          >
                            <Input
                              type="time"
                              value={timeStringFromMinutes(win.startMinute)}
                              onChange={(event) =>
                                updateWindow(win.idx, {
                                  startMinute: minutesFromTimeString(event.target.value) ?? win.startMinute,
                                })
                              }
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={timeStringFromMinutes(win.endMinute)}
                              onChange={(event) =>
                                updateWindow(win.idx, {
                                  endMinute: minutesFromTimeString(event.target.value) ?? win.endMinute,
                                })
                              }
                              className="w-28"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => deleteWindow(win.idx)}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={saveTemplate} disabled={isSaving || isLoading}>
            {isSaving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-background/70 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Overrides</h2>
          <p className="text-sm text-muted-foreground">
            Add specific dates where your availability differs from the weekly template.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Date
            <Input type="date" value={ovDate} onChange={(event) => setOvDate(event.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Start
            <Input type="time" value={ovStart} onChange={(event) => setOvStart(event.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            End
            <Input type="time" value={ovEnd} onChange={(event) => setOvEnd(event.target.value)} />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium">
            <span>Kind</span>
            <Select value={ovKind} onValueChange={(value) => setOvKind(value as "AVAILABLE" | "UNAVAILABLE")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">AVAILABLE (add)</SelectItem>
                <SelectItem value="UNAVAILABLE">UNAVAILABLE (subtract)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
            Note (optional)
            <Input value={ovNote} onChange={(event) => setOvNote(event.target.value)} />
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={createOverride} disabled={isCreatingOverride}>
            {isCreatingOverride ? "Creating…" : "Create override"}
          </Button>
        </div>

        <div className="space-y-3">
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overrides yet.</p>
          ) : (
            <div className="space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/5 px-4 py-3"
                >
                  <div className="flex flex-col gap-1 text-sm">
                    <span>
                      <strong>{override.kind}</strong> {override.startAt} → {override.endAt}
                    </span>
                    {override.note ? (
                      <span className="text-xs text-muted-foreground">{override.note}</span>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setOverrideToDelete(override)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-background/70 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Effective availability preview</h2>
          <p className="text-sm text-muted-foreground">
            See how weekly windows and overrides combine for a particular date.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Date
            <Input type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} />
          </label>
          {effectiveForPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">No availability for that day.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {effectiveForPreview.map((interval, index) => (
                <li key={index} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <span className="font-semibold">
                    {timeStringFromMinutes(interval.start)} – {timeStringFromMinutes(interval.end)}
                  </span>
                  <span className="text-muted-foreground">({timeZone})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(overrideToDelete)}
        onOpenChange={(open) => {
          if (!open) setOverrideToDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete override</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The override will be removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOverrideToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => overrideToDelete && deleteOverride(overrideToDelete.id)}
              disabled={isDeletingOverride}
            >
              {isDeletingOverride ? "Deleting…" : "Delete override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
