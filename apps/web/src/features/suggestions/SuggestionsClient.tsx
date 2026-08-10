"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { toast } from "sonner"

import { ApiError, fetchJson } from "@/lib/http"
import {
  EVENT_ARCHETYPES,
  EVENT_ARCHETYPE_IDS,
  type EventArchetypeId,
} from "@/lib/suggestions/event-archetypes"

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

type EventAwareExplanation = {
  archetypeId: EventArchetypeId
  baseRank: number
  baseScoreTotal: number
  targetTurnout: number
  broadTurnout: number
  timeFit: number
  fairness: number
  inconvenience: number
  targetAvailableUserIds: string[]
  targetMissingUserIds: string[]
  warnings: string[]
}

type Candidate = {
  rank: number
  startAt: string
  endAt: string
  attendanceRatio: number
  score: { total: number; attendance: number; inconvenience: number; fairness: number }
  availableUserIds: string[]
  missingUserIds: string[]
  explanation: {
    why: string[]
    eventAware?: EventAwareExplanation
  }
}

function minuteToHHMM(minute: number) {
  const hour = Math.floor(minute / 60)
  const remainder = minute % 60
  return `${String(hour).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

const DEFAULT_EVENT_ARCHETYPE_ID: EventArchetypeId =
  "general_meeting"

const DEFAULT_EVENT_ARCHETYPE =
  EVENT_ARCHETYPES[DEFAULT_EVENT_ARCHETYPE_ID]

const DURATION_OPTIONS = Array.from(
  new Set([
    15,
    30,
    45,
    60,
    90,
    120,
    ...EVENT_ARCHETYPE_IDS.map(
      (id) => EVENT_ARCHETYPES[id].durationMinutes,
    ),
  ]),
).sort((a, b) => a - b)

export default function SuggestionsClient({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [targetSelected, setTargetSelected] = useState<string[]>([])
  const [eventArchetypeId, setEventArchetypeId] =
    useState<EventArchetypeId>(DEFAULT_EVENT_ARCHETYPE_ID)

  const archetype = EVENT_ARCHETYPES[eventArchetypeId]
  const effectiveTargetUserIds =
    archetype.broadAudience ? selected : targetSelected

  const [timeZone, setTimeZone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  )
  const [rangeStart, setRangeStart] = useState<string>(() => DateTime.now().toISODate() ?? "")
  const [rangeEnd, setRangeEnd] = useState<string>(() => DateTime.now().plus({ days: 7 }).toISODate() ?? "")
  const [durationMinutes, setDurationMinutes] =
    useState<number>(DEFAULT_EVENT_ARCHETYPE.durationMinutes)
  const [stepMinutes, setStepMinutes] =
    useState<number>(DEFAULT_EVENT_ARCHETYPE.stepMinutes)
  const [dayStart, setDayStart] = useState<string>(
    minuteToHHMM(DEFAULT_EVENT_ARCHETYPE.dayStartMinute),
  )
  const [dayEnd, setDayEnd] = useState<string>(
    minuteToHHMM(DEFAULT_EVENT_ARCHETYPE.dayEndMinute),
  )
  const [title, setTitle] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const router = useRouter()
  const [requestId, setRequestId] = useState<string | null>(null)
  const [confirmingRank, setConfirmingRank] = useState<number | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [writeBack, setWriteBack] = useState(false)
  const baseId = useId()
  const fieldIds = {
    eventType: `${baseId}-event-type`,
    title: `${baseId}-title`,
    timeZone: `${baseId}-timezone`,
    rangeStart: `${baseId}-range-start`,
    rangeEnd: `${baseId}-range-end`,
    dayStart: `${baseId}-day-start`,
    dayEnd: `${baseId}-day-end`,
  }

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
        const initiallySelected = fetched.slice(0, 2).map((member) => member.userId)

        setMembers(fetched)
        setSelected(initiallySelected)
        setTargetSelected(initiallySelected)
      } catch {
        setMembers([])
        setSelected([])
        setTargetSelected([])
      }
    })()
  }, [orgId])

  function toggleUser(userId: string) {
    const wasSelected = selected.includes(userId)

    setSelected(
      wasSelected
        ? selected.filter((id) => id !== userId)
        : [...selected, userId],
    )

    setTargetSelected((previous) => {
      if (wasSelected) {
        return previous.filter((id) => id !== userId)
      }

      if (archetype.broadAudience && !previous.includes(userId)) {
        return [...previous, userId]
      }

      return previous
    })
  }

  function toggleTargetUser(userId: string) {
    if (!selected.includes(userId)) return

    setTargetSelected((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    )
  }

  function changeEventArchetype(value: string) {
    const nextId = value as EventArchetypeId

    if (!EVENT_ARCHETYPE_IDS.includes(nextId)) {
      return
    }

    const nextArchetype = EVENT_ARCHETYPES[nextId]

    setEventArchetypeId(nextId)
    setDurationMinutes(nextArchetype.durationMinutes)
    setStepMinutes(nextArchetype.stepMinutes)
    setDayStart(minuteToHHMM(nextArchetype.dayStartMinute))
    setDayEnd(minuteToHHMM(nextArchetype.dayEndMinute))

    if (nextArchetype.broadAudience) {
      setTargetSelected(selected)
      return
    }

    setTargetSelected((previous) => {
      const stillSelected = previous.filter((id) => selected.includes(id))
      return stillSelected.length > 0 ? stillSelected : selected
    })
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
            eventArchetypeId,
            targetUserIds: effectiveTargetUserIds,
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
            <label htmlFor={fieldIds.eventType} className="text-sm font-medium">
              Event type
            </label>
            <Select
              value={eventArchetypeId}
              onValueChange={changeEventArchetype}
            >
              <SelectTrigger id={fieldIds.eventType} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_ARCHETYPE_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {EVENT_ARCHETYPES[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {archetype.description}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor={fieldIds.title} className="text-sm font-medium">
              Title (optional)
            </label>
            <Input
              id={fieldIds.title}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={fieldIds.timeZone} className="text-sm font-medium">
              Time zone
            </label>
            <Input
              id={fieldIds.timeZone}
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={fieldIds.rangeStart} className="text-sm font-medium">
              Range start
            </label>
            <Input
              id={fieldIds.rangeStart}
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={fieldIds.rangeEnd} className="text-sm font-medium">
              Range end
            </label>
            <Input
              id={fieldIds.rangeEnd}
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
            />
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
                {DURATION_OPTIONS.map((value) => (
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
            <label htmlFor={fieldIds.dayStart} className="text-sm font-medium">
              Day start
            </label>
            <Input
              id={fieldIds.dayStart}
              type="time"
              value={dayStart}
              onChange={(event) => setDayStart(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={fieldIds.dayEnd} className="text-sm font-medium">
              Day end
            </label>
            <Input
              id={fieldIds.dayEnd}
              type="time"
              value={dayEnd}
              onChange={(event) => setDayEnd(event.target.value)}
            />
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

        {archetype.broadAudience ? (
          <div className="rounded-lg border border-border/60 px-3 py-3">
            <p className="text-sm font-medium">Priority attendees</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This event type treats every selected attendee as part of the priority group.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Priority attendees</p>
                <p className="text-xs text-muted-foreground">
                  These attendees receive extra weight when slots are ranked.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Select at least one
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {members
                .filter((member) => selected.includes(member.userId))
                .map((member) => (
                  <label
                    key={member.userId}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={targetSelected.includes(member.userId)}
                      onCheckedChange={() => toggleTargetUser(member.userId)}
                    />
                    <div>
                      <span>{nameFor(member.userId)}</span>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </label>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Checkbox checked={writeBack} onCheckedChange={(checked) => setWriteBack(Boolean(checked))} />
          <span className="text-sm">Write to Google Calendar (optional)</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={
              loading ||
              selected.length === 0 ||
              effectiveTargetUserIds.length === 0
            }
          >
            {loading ? "Generating…" : "Generate suggestions"}
          </Button>
          {selected.length > 0 && effectiveTargetUserIds.length === 0 ? (
            <p className="text-sm text-destructive">
              Select at least one priority attendee.
            </p>
          ) : null}
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
                  {candidate.explanation.eventAware ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        Event-aware score: {candidate.score.total.toFixed(2)} · Target turnout:{" "}
                        {formatPercent(candidate.explanation.eventAware.targetTurnout)} · Broad turnout:{" "}
                        {formatPercent(candidate.explanation.eventAware.broadTurnout)} · Time fit:{" "}
                        {formatPercent(candidate.explanation.eventAware.timeFit)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Base score: {candidate.explanation.eventAware.baseScoreTotal.toFixed(2)} ·
                        Fairness: {formatPercent(candidate.explanation.eventAware.fairness)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Score: {candidate.score.total.toFixed(2)} (att {candidate.score.attendance.toFixed(2)} · inc {candidate.score.inconvenience.toFixed(2)} · fair {candidate.score.fairness.toFixed(2)})
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Available: {candidate.availableUserIds.length} · Missing: {candidate.missingUserIds.length}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {candidate.explanation?.why?.slice(0, 6).map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
                {candidate.explanation.eventAware?.targetMissingUserIds.length ? (
                  <div className="text-xs text-muted-foreground">
                    Missing priority attendees:{" "}
                    {candidate.explanation.eventAware.targetMissingUserIds
                      .map((id) => nameFor(id))
                      .join(", ")}
                  </div>
                ) : null}

                {candidate.explanation.eventAware?.warnings.length ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {candidate.explanation.eventAware.warnings.map((warning) => (
                      <p key={warning}>Warning: {warning}</p>
                    ))}
                  </div>
                ) : null}

                {candidate.missingUserIds.length ? (
                  <div className="text-xs text-muted-foreground">
                    Missing overall: {candidate.missingUserIds.map((id) => nameFor(id)).join(", ")}
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
