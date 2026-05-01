"use client";

import {
  createAuditNote,
  fetchAuditEvents,
  type AuditEvent,
  type AuditEventsResponse,
} from "@/lib/api/admin";
import {
  auditEventLabel,
  auditEventSummary,
  auditEventWhen,
  auditTargetLabel,
} from "@/lib/dashboard/auditTrail";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type AuditTarget = {
  patientUserId?: string | null;
  bookingIntentId?: string | null;
  appointmentId?: string | null;
};

async function readBackendMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === "string" && body.message.trim()
    ? body.message
    : `Audit request failed (${res.status}).`;
}

export function AuditTrailPanel({
  target,
  title = "Audit trail",
}: {
  target: AuditTarget;
  title?: string;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sessionToken(): Promise<string> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sign in again to use audit trail.");
    }
    return session.access_token;
  }

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const token = await sessionToken();
      const response = await fetchAuditEvents(token, target);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      const payload = await response.json() as AuditEventsResponse;
      setEvents(payload.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load audit trail.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    const trimmed = note.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await sessionToken();
      const response = await createAuditNote(token, {
        ...target,
        note: trimmed,
      });
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      setNote("");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add audit note.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [target.patientUserId, target.bookingIntentId, target.appointmentId]);

  return (
    <section
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        borderRadius: 8,
        border: "1px solid #e5ebf5",
        background: "#fff",
      }}
      aria-label={title}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "#172033" }}>
            {title}
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            Notes and system events for this {auditTargetLabel(target)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          style={{
            padding: "6px 9px",
            borderRadius: 7,
            border: "1px solid #dbe3ef",
            background: "#fff",
            color: "#172033",
            fontSize: 12,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add internal note"
          maxLength={2000}
          style={{
            minWidth: 0,
            padding: "9px 10px",
            borderRadius: 8,
            border: "1px solid #dbe3ef",
            fontSize: 13,
            color: "#172033",
          }}
        />
        <button
          type="button"
          onClick={() => void saveNote()}
          disabled={saving || !note.trim()}
          style={{
            padding: "9px 11px",
            borderRadius: 8,
            border: "1px solid #172033",
            background: saving || !note.trim() ? "#94a3b8" : "#172033",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: saving || !note.trim() ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Add note"}
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      ) : null}

      {!loading && events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
          No audit events yet.
        </p>
      ) : null}

      {events.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {events.map((event) => (
            <li key={event.id} style={{ display: "grid", gap: 3 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#172033", fontWeight: 800 }}>
                {auditEventLabel(event)}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
                {auditEventSummary(event)}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                {auditEventWhen(event)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
