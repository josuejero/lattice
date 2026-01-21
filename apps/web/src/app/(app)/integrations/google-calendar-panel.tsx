"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ApiError, fetchJson } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type CalendarRow = {
  idHash: string
  summary: string
  primary: boolean
  accessRole: string
  isBusySource: boolean
}

export function GoogleCalendarPanel({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CalendarRow[]>([])
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const selected = useMemo(
    () => new Set(rows.filter((r) => r.isBusySource).map((r) => r.idHash)),
    [rows],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchJson<{ calendars?: CalendarRow[] }>(
        `/api/orgs/${orgId}/integrations/google/calendars`,
        { cache: "no-store" },
      )
      setRows(data.calendars ?? [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load calendars."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(idHash: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.idHash === idHash ? { ...row, isBusySource: !row.isBusySource } : row,
      ),
    )
  }

  async function save() {
    setSaving(true)
    try {
      await fetchJson(`/api/orgs/${orgId}/integrations/google/selections`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ busyCalendarIdHashes: [...selected] }),
      })
      toast.success("Selections saved")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Save failed."
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function sync() {
    setSyncing(true)
    try {
      const data = await fetchJson<{ blocks?: number }>(
        `/api/orgs/${orgId}/integrations/google/sync`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      )
      toast.success(`Synced. Busy blocks stored: ${data.blocks ?? 0}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sync failed."
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetchJson(`/api/orgs/${orgId}/integrations/google/calendars`, {
        method: "DELETE",
      })
      toast.success("Disconnected. Reloading…")
      window.location.reload()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Disconnect failed."
      toast.error(message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading calendars…</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row) => (
          <label
            key={row.idHash}
            className="flex flex-wrap items-start gap-3 text-sm"
          >
            <Checkbox
              checked={row.isBusySource}
              onCheckedChange={() => toggle(row.idHash)}
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {row.summary}
                {row.primary ? " (Primary)" : ""}
              </span>
              <span className="text-xs text-muted-foreground">{row.accessRole}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save selections"}
        </Button>
        <Button variant="outline" onClick={sync} disabled={syncing} size="sm">
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" disabled={disconnecting} size="sm">
              Disconnect
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect Google Calendar</DialogTitle>
              <DialogDescription>
                This will disconnect all synced calendars and stop future updates.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={disconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Link
          href={`/api/orgs/${orgId}/integrations/google/start`}
          className="text-sm text-primary hover:underline"
        >
          Reconnect
        </Link>
      </div>
    </div>
  )
}
