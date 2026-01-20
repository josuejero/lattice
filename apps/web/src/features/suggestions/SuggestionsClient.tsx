"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"

type Member = {
  userId: string
  user: { name: string | null; email: string | null }
  role: string
}

type Candidate = {
  rank: number
  startAt: string
  endAt: string
  attendanceRatio: number
  score: { total: number; attendance: number; inconvenience: number; fairness: number }
  availableUserIds: string[]
  missingUserIds: string[]
  explanation: { why: string[] }
}

export default function SuggestionsClient({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const [timeZone, setTimeZone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  )
  const [rangeStart, setRangeStart] = useState<string>(() => DateTime.now().toISODate() ?? "")
  const [rangeEnd, setRangeEnd] = useState<string>(() => DateTime.now().plus({ days: 7 }).toISODate() ?? "")
  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [stepMinutes, setStepMinutes] = useState<number>(15)
  const [dayStart, setDayStart] = useState<string>("08:00")
  const [dayEnd, setDayEnd] = useState<string>("20:00")
  const [title, setTitle] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const router = useRouter()
  const [requestId, setRequestId] = useState<string | null>(null)
  const [confirmingRank, setConfirmingRank] = useState<number | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [writeBack, setWriteBack] = useState(false)

  const memberById = useMemo(() => {
    const map = new Map<string, Member>()
    for (const member of members) {
      map.set(member.userId, member)
    }
    return map
  }, [members])

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/orgs/${orgId}/members`)
      const json = await res.json()
      const fetched = Array.isArray(json.members) ? (json.members as Member[]) : []
      setMembers(fetched)
      setSelected(fetched.slice(0, 2).map((member) => member.userId))
    })()
  }, [orgId])

  function toggleUser(userId: string) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setCandidates([])
    setRequestId(null)
    setConfirmError(null)
    setConfirmingRank(null)

    try {
      const res = await fetch(`/api/orgs/${orgId}/suggestions/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          timeZone,
          rangeStart,
          rangeEnd,
          durationMinutes,
          stepMinutes,
          dayStart,
          dayEnd,
          attendeeUserIds: selected,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate suggestions")
      }

      setRequestId(json.request?.id ?? null)
      setCandidates(Array.isArray(json.candidates) ? json.candidates : [])
    } catch (err: any) {
      setError(err?.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  function formatLocal(iso: string) {
    return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat("ccc LLL d, t")
  }

  function nameFor(userId: string) {
    const member = memberById.get(userId)
    return member?.user.name || member?.user.email || userId
  }

  async function confirm(rank: number) {
    if (!requestId) return
    setConfirmingRank(rank)
    setConfirmError(null)

    const res = await fetch(`/api/orgs/${orgId}/suggestions/requests/${requestId}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateRank: rank, writeBackToGoogle: writeBack, conflictCheck: true }),
    })

    const json = await res.json().catch(() => ({}))
    if (res.status === 409) {
      setConfirmError("Conflict detected. Try a different slot or re-sync calendars.")
      setConfirmingRank(null)
      return
    }

    if (!res.ok || !json?.event?.id) {
      setConfirmError(json?.error ?? "Failed to confirm.")
      setConfirmingRank(null)
      return
    }

    router.push(`/events/${json.event.id}`)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h2>New request - {orgName}</h2>

      <form onSubmit={onSubmit} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, maxWidth: 900, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Title (optional)
            <input value={title} onChange={(event) => setTitle(event.target.value)} style={{ width: "100%" }} />
          </label>

          <label>
            Time zone
            <input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} style={{ width: "100%" }} />
          </label>

          <label>
            Range start
            <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
          </label>

          <label>
            Range end
            <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
          </label>

          <label>
            Duration
            <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </label>

          <label>
            Step
            <select value={stepMinutes} onChange={(event) => setStepMinutes(Number(event.target.value))}>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
            </select>
          </label>

          <label>
            Day start
            <input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} />
          </label>

          <label>
            Day end
            <input type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Attendees</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
            {members.map((member) => (
              <label key={member.userId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={selected.includes(member.userId)} onChange={() => toggleUser(member.userId)} />
                <span>
                  {nameFor(member.userId)} <em style={{ opacity: 0.7 }}>({member.role})</em>
                </span>
              </label>
            ))}
          </div>
        </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="submit" disabled={loading || selected.length === 0}>
          {loading ? "Generating..." : "Generate suggestions"}
        </button>
        {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
      </div>
    </form>

    <div style={{ marginTop: 12 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={writeBack} onChange={(event) => setWriteBack(event.target.checked)} />
        <span>Write to Google Calendar (optional)</span>
      </label>
    </div>
    {confirmError ? <p style={{ color: "crimson" }}>{confirmError}</p> : null}

    <div style={{ marginTop: 24 }}>
      <h3>Results</h3>
      {candidates.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No results yet. Create a request to generate ranked slots.</p>
      ) : (
        <ol style={{ paddingLeft: 20 }}>
          {candidates.map((candidate) => (
            <li key={candidate.rank} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600 }}>
                #{candidate.rank}: {formatLocal(candidate.startAt)} — {formatLocal(candidate.endAt)}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Score: {candidate.score.total.toFixed(2)} (
                  att {candidate.score.attendance.toFixed(2)} · inc {candidate.score.inconvenience.toFixed(2)} · fair{" "}
                  {candidate.score.fairness.toFixed(2)})
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Available: {candidate.availableUserIds.length} · Missing: {candidate.missingUserIds.length}
                </div>
                <ul style={{ marginTop: 6 }}>
                  {candidate.explanation?.why?.slice(0, 6).map((line, index) => (
                    <li key={index} style={{ fontSize: 13 }}>
                      {line}
                    </li>
                  ))}
                </ul>
                {candidate.missingUserIds.length ? (
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    Missing: {candidate.missingUserIds.map((id) => nameFor(id)).join(", ")}
                  </div>
                ) : null}
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => confirm(candidate.rank)}
                    disabled={!requestId || confirmingRank === candidate.rank}
                  >
                    {confirmingRank === candidate.rank ? "Confirming..." : "Confirm this slot"}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
