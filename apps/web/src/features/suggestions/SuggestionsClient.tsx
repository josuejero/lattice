"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { toast } from "sonner"

import { ApiError, fetchJson } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
    void (async () => {
      try {
        const data = await fetchJson<{ members?: Member[] }>(`/api/orgs/${orgId}/members`)
        const fetched = Array.isArray(data.members) ? data.members : []
        setMembers(fetched)
        setSelected(fetched.slice(0, 2).map((member) => member.userId))
      } catch {
        setMembers([])
        setSelected([])
      }
    })()
  }, [orgId])

  function toggleUser(userId: string) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
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
      const data = await fetchJson<{ request?: { id?: string }; candidates?: Candidate[] }>(
        `/api/orgs/${orgId}/suggestions/requests`,
        {
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
        },
      )

      setRequestId(data.request?.id ?? null)
      setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error(message)
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

    try {
      const data = await fetchJson<{ event?: { id?: string } }>(
        `/api/orgs/${orgId}/suggestions/requests/${requestId}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateRank: rank, writeBackToGoogle: writeBack, conflictCheck: true }),
        },
      )

      if (!data.event?.id) {
        throw new Error("Failed to confirm.")
      }

      router.push(`/events/${data.event.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const message = "Conflict detected. Try a different slot or re-sync calendars."
        setConfirmError(message)
        toast.error(message)
      } else {
        const message = err instanceof Error ? err.message : "Failed to confirm."
        setConfirmError(message)
        toast.error(message)
      }
    } finally {
      setConfirmingRank(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">New request - {orgName}</h2>
        <p className="text-sm text-muted-foreground">
          Create a request to generate ranked slots based on member availability.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-border bg-background/70 p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Time zone</label>
            <Input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Range start</label>
            <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Range end</label>
            <Input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Duration</label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(value) => setDurationMinutes(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 45, 60, 90, 120].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Step</label>
            <Select value={String(stepMinutes)} onValueChange={(value) => setStepMinutes(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 30].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Day start</label>
            <Input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Day end</label>
            <Input type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Attendees</p>
            <p className="text-xs text-muted-foreground">Select at least one</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {members.map((member) => (
              <label
                key={member.userId}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={selected.includes(member.userId)}
                  onCheckedChange={() => toggleUser(member.userId)}
                />
                <div>
                  <span>{nameFor(member.userId)}</span>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox checked={writeBack} onCheckedChange={(checked) => setWriteBack(Boolean(checked))} />
          <span className="text-sm">Write to Google Calendar (optional)</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={loading || selected.length === 0}>
            {loading ? "Generating…" : "Generate suggestions"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </form>

      {confirmError ? <p className="text-sm text-destructive">{confirmError}</p> : null}

      <div className="space-y-4 rounded-2xl border border-border bg-background/70 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Results</h3>
          <p className="text-sm text-muted-foreground">
            Ranked slots are ordered by score; confirm one to create an event.
          </p>
        </div>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No results yet. Create a request to generate ranked slots.
          </p>
        ) : (
          <div className="space-y-4">
            {candidates.map((candidate) => (
              <div
                key={candidate.rank}
                className="space-y-3 rounded-2xl border border-border/60 bg-muted/5 p-4"
              >
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">
                    #{candidate.rank}: {formatLocal(candidate.startAt)} — {formatLocal(candidate.endAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Score: {candidate.score.total.toFixed(2)} (att {candidate.score.attendance.toFixed(2)} · inc {candidate.score.inconvenience.toFixed(2)} · fair {candidate.score.fairness.toFixed(2)})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Available: {candidate.availableUserIds.length} · Missing: {candidate.missingUserIds.length}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {candidate.explanation?.why?.slice(0, 6).map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
                {candidate.missingUserIds.length ? (
                  <div className="text-xs text-muted-foreground">
                    Missing: {candidate.missingUserIds.map((id) => nameFor(id)).join(", ")}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => confirm(candidate.rank)}
                    disabled={!requestId || confirmingRank === candidate.rank}
                  >
                    {confirmingRank === candidate.rank ? "Confirming…" : "Confirm this slot"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
