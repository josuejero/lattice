"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ApiError, fetchJson } from "@/lib/http"
import { Button } from "@/components/ui/button"

export function WriteBackButton(props: { orgId: string; eventId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setIsLoading(true)
    setError(null)

    try {
      await fetchJson(`/api/orgs/${props.orgId}/events/${props.eventId}/writeback/google`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      toast.success("Event written to Google Calendar")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "writeback_failed"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={isLoading}>
        {isLoading ? "Writing to Google..." : "Write to Google Calendar"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
