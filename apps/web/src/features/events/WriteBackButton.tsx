"use client"

import { useState } from "react"

export function WriteBackButton(props: { orgId: string; eventId: string }) {
  const [status, setStatus] = useState<string>("idle")
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setStatus("loading")
    setError(null)

    const res = await fetch(`/api/orgs/${props.orgId}/events/${props.eventId}/writeback/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus("error")
      setError(json?.error ?? "writeback_failed")
      return
    }

    setStatus("done")
  }

  return (
    <div>
      <button onClick={onClick} disabled={status === "loading"}>
        {status === "loading" ? "Writing to Google..." : "Write to Google Calendar"}
      </button>
      {error ? <div style={{ color: "crimson", marginTop: 8 }}>{error}</div> : null}
    </div>
  )
}
