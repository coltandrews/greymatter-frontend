"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/app/intake/usStates";

type DraftData = {
  for_self?: boolean;
  service_state?: string;
};

type UiStep = "eligibility" | "service_state" | "done";

function resolveUiStep(
  row: { step: string; data: unknown } | null,
): UiStep {
  if (!row) {
    return "eligibility";
  }
  const d = row.data as DraftData;
  if (row.step === "paused_before_scheduling") {
    return "done";
  }
  if (row.step === "service_state") {
    return "service_state";
  }
  if (row.step === "eligibility" && typeof d?.for_self === "boolean") {
    return "service_state";
  }
  return "eligibility";
}

async function ensureSubmission(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: rows, error: selErr } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .limit(1);

  if (selErr) {
    throw new Error(selErr.message);
  }
  if (rows && rows.length > 0) {
    return;
  }

  const { error: insErr } = await supabase.from("submissions").insert({
    user_id: userId,
    status: "in_progress",
  });
  if (insErr) {
    throw new Error(insErr.message);
  }
}

export function IntakeWizard() {
  const router = useRouter();
  const [uiStep, setUiStep] = useState<UiStep>("eligibility");
  const [forSelf, setForSelf] = useState<boolean | null>(null);
  const [serviceState, setServiceState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: row, error: qErr } = await supabase
      .from("intake_drafts")
      .select("step, data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const d = row?.data as DraftData | undefined;
    if (d && typeof d.for_self === "boolean") {
      setForSelf(d.for_self);
    }
    if (d?.service_state) {
      setServiceState(d.service_state);
    }

    // Repair: draft can exist without a submission if insert failed earlier or user was on an old build.
    if (row) {
      try {
        await ensureSubmission(supabase, user.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not sync submission record.",
        );
      }
    }

    const resolved = resolveUiStep(row ?? null);
    if (resolved === "done") {
      setLoading(false);
      router.replace("/hub");
      return;
    }
    setUiStep(resolved);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  async function saveEligibility(e: React.FormEvent) {
    e.preventDefault();
    if (forSelf === null) {
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "service_state",
        data: { for_self: forSelf },
      },
      { onConflict: "user_id" },
    );

    if (upErr) {
      setSaving(false);
      setError(upErr.message);
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not start submission.");
      return;
    }

    setSaving(false);
    setSaved(false);
    setUiStep("service_state");
  }

  async function saveServiceState(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceState) {
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    try {
      await ensureSubmission(supabase, user.id);
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Could not sync submission record.",
      );
      return;
    }

    const prior = (forSelf !== null ? { for_self: forSelf } : {}) as DraftData;
    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "paused_before_scheduling",
        data: { ...prior, service_state: serviceState },
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    router.push("/hub");
    router.refresh();
  }

  if (loading) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading…</p>
    );
  }

  const btnBase = {
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer" as const,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#172033",
  };

  const labelStyle = {
    display: "grid" as const,
    gap: 6,
    fontSize: 14,
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 16,
  };

  if (uiStep === "service_state") {
    return (
      <form onSubmit={saveServiceState} style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
          Which state are you in? (Used for provider availability.)
        </p>
        <label style={labelStyle}>
          State
          <select
            required
            value={serviceState}
            onChange={(e) => {
              setServiceState(e.target.value);
              setSaved(false);
            }}
            style={inputStyle}
          >
            <option value="">Select…</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        {saved ? (
          <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>Saved.</p>
        ) : null}
        <button
          type="submit"
          disabled={!serviceState || saving}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: !serviceState || saving ? "#94a3b8" : "#172033",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: !serviceState || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={saveEligibility} style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
        Are you completing this intake for yourself?
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setForSelf(true);
            setSaved(false);
          }}
          style={{
            ...btnBase,
            borderColor: forSelf === true ? "#172033" : "#cbd5e1",
            boxShadow: forSelf === true ? "0 0 0 2px #172033" : undefined,
          }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => {
            setForSelf(false);
            setSaved(false);
          }}
          style={{
            ...btnBase,
            borderColor: forSelf === false ? "#172033" : "#cbd5e1",
            boxShadow: forSelf === false ? "0 0 0 2px #172033" : undefined,
          }}
        >
          No
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={forSelf === null || saving}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: "none",
          background: forSelf === null || saving ? "#94a3b8" : "#172033",
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor: forSelf === null || saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
