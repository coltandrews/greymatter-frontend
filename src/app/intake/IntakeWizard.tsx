"use client";

import { createClient } from "@/lib/supabase/client";
import {
  basicInfoComplete,
  type IntakeDraftData,
} from "@/lib/intake/draftData";
import { US_STATES } from "@/app/intake/usStates";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UiStep = "basic_info" | "eligibility" | "service_state" | "done";

function resolveUiStep(
  row: { step: string; data: unknown } | null,
): UiStep {
  if (!row) {
    return "basic_info";
  }
  const d = row.data as IntakeDraftData;
  if (row.step === "paused_before_scheduling") {
    return "done";
  }
  if (!basicInfoComplete(d)) {
    return "basic_info";
  }
  if (row.step === "service_state") {
    return "service_state";
  }
  if (row.step === "eligibility" && typeof d.for_self === "boolean") {
    return "service_state";
  }
  return "eligibility";
}

const EMPTY_BASIC: Omit<
  IntakeDraftData,
  "for_self" | "service_state"
> = {
  legal_first_name: "",
  legal_last_name: "",
  preferred_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  phone_secondary: "",
  street_address: "",
  address_line2: "",
  city: "",
  address_state: "",
  zip: "",
  country: "US",
};

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

function draftFromBasicState(b: typeof EMPTY_BASIC): IntakeDraftData {
  return {
    legal_first_name: b.legal_first_name?.trim() || undefined,
    legal_last_name: b.legal_last_name?.trim() || undefined,
    preferred_name: b.preferred_name?.trim() || undefined,
    date_of_birth: b.date_of_birth?.trim() || undefined,
    gender: b.gender?.trim() || undefined,
    phone: b.phone?.trim() || undefined,
    phone_secondary: b.phone_secondary?.trim() || undefined,
    street_address: b.street_address?.trim() || undefined,
    address_line2: b.address_line2?.trim() || undefined,
    city: b.city?.trim() || undefined,
    address_state: b.address_state?.trim() || undefined,
    zip: b.zip?.trim() || undefined,
    country: b.country?.trim() || "US",
  };
}

function loadBasicFromDraft(d: IntakeDraftData | undefined): typeof EMPTY_BASIC {
  if (!d) {
    return { ...EMPTY_BASIC };
  }
  return {
    legal_first_name: d.legal_first_name ?? "",
    legal_last_name: d.legal_last_name ?? "",
    preferred_name: d.preferred_name ?? "",
    date_of_birth: d.date_of_birth ?? "",
    gender: typeof d.gender === "string" ? d.gender : "",
    phone: d.phone ?? "",
    phone_secondary: d.phone_secondary ?? "",
    street_address: d.street_address ?? "",
    address_line2: d.address_line2 ?? "",
    city: d.city ?? "",
    address_state: d.address_state ?? "",
    zip: d.zip ?? "",
    country: d.country?.trim() || "US",
  };
}

export function IntakeWizard() {
  const router = useRouter();
  const [uiStep, setUiStep] = useState<UiStep>("basic_info");
  const [basic, setBasic] = useState(loadBasicFromDraft(undefined));
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

    const d = row?.data as IntakeDraftData | undefined;
    setBasic(loadBasicFromDraft(d));
    if (d && typeof d.for_self === "boolean") {
      setForSelf(d.for_self);
    }
    const svc = d?.service_state?.trim() ?? "";
    const addrSt = d?.address_state?.trim() ?? "";
    setServiceState(svc || addrSt);

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

  async function saveBasicInfo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const merged = { ...EMPTY_BASIC, ...basic };
    const asDraft = draftFromBasicState(merged);
    if (!basicInfoComplete({ ...asDraft })) {
      setError("Please fill in all required fields. Phone needs at least 10 digits.");
      return;
    }

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

    const { data: existing } = await supabase
      .from("intake_drafts")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    const prior = (existing?.data as IntakeDraftData | undefined) ?? {};

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "eligibility",
        data: { ...prior, ...asDraft },
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
    setUiStep("eligibility");
  }

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

    const { data: existing } = await supabase
      .from("intake_drafts")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    const prior = (existing?.data as IntakeDraftData | undefined) ?? {};
    const asDraft = draftFromBasicState(basic);
    const data: IntakeDraftData = { ...prior, ...asDraft, for_self: forSelf };

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "service_state",
        data,
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

    const st = data.service_state?.trim() || data.address_state?.trim() || "";
    setServiceState(st);
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

    const { data: existing } = await supabase
      .from("intake_drafts")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    const prior = (existing?.data as IntakeDraftData | undefined) ?? {};
    const asDraft = draftFromBasicState(basic);
    const data: IntakeDraftData = {
      ...prior,
      ...asDraft,
      ...(forSelf !== null ? { for_self: forSelf } : {}),
      service_state: serviceState,
    };

    const { error: upErr } = await supabase.from("intake_drafts").upsert(
      {
        user_id: user.id,
        step: "paused_before_scheduling",
        data,
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

  const maxDob = new Date().toISOString().slice(0, 10);
  const minDob = new Date(new Date().getFullYear() - 120, 0, 1)
    .toISOString()
    .slice(0, 10);

  if (uiStep === "basic_info") {
    return (
      <form onSubmit={saveBasicInfo} style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
          Start with your contact details. We use this for your chart, scheduling, and required
          disclosures.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>Legal name</p>
          <label style={labelStyle}>
            First name *
            <input
              required
              autoComplete="given-name"
              value={basic.legal_first_name}
              onChange={(e) => {
                setBasic((p) => ({ ...p, legal_first_name: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Last name *
            <input
              required
              autoComplete="family-name"
              value={basic.legal_last_name}
              onChange={(e) => {
                setBasic((p) => ({ ...p, legal_last_name: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Preferred name (optional)
            <input
              autoComplete="nickname"
              value={basic.preferred_name}
              onChange={(e) => {
                setBasic((p) => ({ ...p, preferred_name: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
            Date of birth &amp; gender
          </p>
          <label style={labelStyle}>
            Date of birth *
            <input
              type="date"
              required
              min={minDob}
              max={maxDob}
              value={basic.date_of_birth}
              onChange={(e) => {
                setBasic((p) => ({ ...p, date_of_birth: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Gender *
            <select
              required
              value={basic.gender}
              onChange={(e) => {
                setBasic((p) => ({ ...p, gender: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>Phone</p>
          <label style={labelStyle}>
            Primary phone *
            <input
              type="tel"
              required
              autoComplete="tel"
              placeholder="(555) 555-5555"
              value={basic.phone}
              onChange={(e) => {
                setBasic((p) => ({ ...p, phone: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Secondary phone (optional)
            <input
              type="tel"
              autoComplete="tel"
              value={basic.phone_secondary}
              onChange={(e) => {
                setBasic((p) => ({ ...p, phone_secondary: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>Address</p>
          <label style={labelStyle}>
            Street address *
            <input
              required
              autoComplete="street-address"
              value={basic.street_address}
              onChange={(e) => {
                setBasic((p) => ({ ...p, street_address: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Apt / suite (optional)
            <input
              autoComplete="address-line2"
              value={basic.address_line2}
              onChange={(e) => {
                setBasic((p) => ({ ...p, address_line2: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            City *
            <input
              required
              autoComplete="address-level2"
              value={basic.city}
              onChange={(e) => {
                setBasic((p) => ({ ...p, city: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            State *
            <select
              required
              autoComplete="address-level1"
              value={basic.address_state}
              onChange={(e) => {
                setBasic((p) => ({ ...p, address_state: e.target.value }));
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
          <label style={labelStyle}>
            ZIP code *
            <input
              required
              autoComplete="postal-code"
              value={basic.zip}
              onChange={(e) => {
                setBasic((p) => ({ ...p, zip: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Country
            <select
              value={basic.country}
              onChange={(e) => {
                setBasic((p) => ({ ...p, country: e.target.value }));
                setSaved(false);
              }}
              style={inputStyle}
            >
              <option value="US">United States</option>
            </select>
          </label>
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: saving ? "#94a3b8" : "#172033",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    );
  }

  if (uiStep === "service_state") {
    return (
      <form onSubmit={saveServiceState} style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
          Confirm the state we should use for telehealth eligibility and scheduling. This is usually
          the same as your home address ({basic.address_state || "—"}).
        </p>
        <label style={labelStyle}>
          State for care &amp; scheduling *
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
          {saving ? "Saving…" : "Continue to hub"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={saveEligibility} style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#172033" }}>
        Are you providing this health and eligibility information for yourself?
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
