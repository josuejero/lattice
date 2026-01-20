"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CalendarRow = {
  idHash: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  isBusySource: boolean;
};

export function GoogleCalendarPanel({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const selected = useMemo(() => new Set(rows.filter((r) => r.isBusySource).map((r) => r.idHash)), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/google/calendars`, { cache: "no-store" });
      const json = await res.json();
      setRows(json.calendars ?? []);
    } catch {
      setMsg("Failed to load calendars.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(idHash: string) {
    setRows((prev) => prev.map((r) => (r.idHash === idHash ? { ...r, isBusySource: !r.isBusySource } : r)));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/google/selections`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ busyCalendarIdHashes: [...selected] }),
      });
      if (!res.ok) throw new Error("save_failed");
      setMsg("Saved.");
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setMsg("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/google/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "sync_failed");
      setMsg(`Synced. Busy blocks stored: ${json.blocks ?? 0}`);
    } catch {
      setMsg("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading calendars…</p>;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((r) => (
          <label key={r.idHash} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={r.isBusySource} onChange={() => toggle(r.idHash)} />
            <span>
              {r.summary}
              {r.primary ? " (Primary)" : ""}
            </span>
            <span className="text-muted-foreground">· {r.accessRole}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-3">
        <button className="underline" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save selections"}
        </button>
        <button className="underline" onClick={sync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        <a className="underline" href={`/api/orgs/${orgId}/integrations/google/start`}>
          Reconnect
        </a>
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
