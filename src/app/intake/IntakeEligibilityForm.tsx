"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type EligibilityData = {
  for_self?: boolean;
};

export function IntakeEligibilityForm() {
  const [forSelf, setForSelf] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const { data: row, error: qErr } = await supabase
        .from("intake_drafts")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }

      const d = row?.data as EligibilityData | undefined;
      if (d && typeof d.for_self === "boolean") {
        setForSelf(d.for_self);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleContinue(e: React.FormEvent) {
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
        step: "eligibility",
        data: { for_self: forSelf },
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setSaved(true);
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

  return (
    <form onSubmit={handleContinue} style={{ display: "grid", gap: 16 }}>
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
            boxShadow:
              forSelf === true ? "0 0 0 2px #172033" : undefined,
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
            boxShadow:
              forSelf === false ? "0 0 0 2px #172033" : undefined,
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
      {saved ? (
        <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>Saved.</p>
      ) : null}
      <button
        type="submit"
        disabled={forSelf === null || saving}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: "none",
          background:
            forSelf === null || saving ? "#94a3b8" : "#172033",
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
