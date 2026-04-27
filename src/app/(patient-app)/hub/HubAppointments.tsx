"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchVendorOlaOrderDetails } from "@/lib/api/vendorOla";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./hub.module.css";

export type HubAppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  created_at: string;
  updated_at: string;
  provider_name: string | null;
  ola_redirect_url: string | null;
  ola_popup_message: string | null;
  ola_order_guid: string | null;
};

type OrderDetailState = {
  loading: boolean;
  error: string | null;
  payload: unknown | null;
};

type DisplayDetailRow = {
  label: string;
  value: string;
  mono?: boolean;
  cap?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
  }
  return null;
}

function arrayCount(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return Array.isArray(value) ? value.length : null;
}

function formatOlaDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function providerName(provider: Record<string, unknown> | null): string | null {
  const direct = stringValue(provider, ["name", "display_name", "provider_name"]);
  if (direct) {
    return direct;
  }
  const first = stringValue(provider, ["first_name", "firstName"]);
  const last = stringValue(provider, ["last_name", "lastName"]);
  return [first, last].filter(Boolean).join(" ").trim() || null;
}

function orderDetailRows(payload: unknown): DisplayDetailRow[] {
  const root = asRecord(payload);
  const result = asRecord(root?.result) ?? root;
  if (!result) {
    return [];
  }

  const provider = asRecord(result.provider);
  const providerDetail = asRecord(asRecord(provider?.user_detail)?.data);
  const service = asRecord(result.service);
  const scheduled = asRecord(result.scheduled);

  const rows: DisplayDetailRow[] = [];
  const add = (
    label: string,
    value: string | null | undefined,
    options: Pick<DisplayDetailRow, "mono" | "cap"> = {},
  ) => {
    if (value) {
      rows.push({ label, value, ...options });
    }
  };

  add("Ola status", stringValue(result, ["status", "order_status", "appointment_status"]), {
    cap: true,
  });
  add("Service", stringValue(service, ["service_name", "name", "title"]) ?? stringValue(result, ["service_name"]));
  add("Service type", stringValue(result, ["service_type", "type"]), { cap: true });
  add("Scheduled", formatOlaDate(stringValue(scheduled, [
    "schedule_start_date",
    "scheduleStartDate",
    "start_date",
    "startDate",
    "starts_at",
    "start_time",
    "appointment_date",
    "date",
  ])));
  add("Clinician", providerName(provider));
  add("Clinician title", stringValue(providerDetail, ["title"]));
  add("Pharmacy", stringValue(result, ["pharmacy_name", "pharmacyName"]));
  add("Pharmacy phone", stringValue(result, ["pharmacy_phone", "pharmacyPhone"]));
  add("Pharmacy address", stringValue(result, ["pharmacy_address", "pharmacyAddress"]));
  add("Cancellation reason", stringValue(result, ["cancellation_reason", "cancellationReason"]));

  const prescriptionCount = arrayCount(result, "prescriptions");
  if (prescriptionCount != null) {
    add("Prescriptions", String(prescriptionCount));
  }
  const consultNoteCount = arrayCount(result, "consult_notes");
  if (consultNoteCount != null) {
    add("Clinical notes", String(consultNoteCount));
  }

  add("Ola order", stringValue(result, ["order_guid", "orderGuid"]), { mono: true });
  add("Ola updated", formatOlaDate(stringValue(result, ["updated_at", "updatedAt"])));

  return rows;
}

function responseMessage(payload: unknown): string | null {
  return stringValue(asRecord(payload), ["message", "error"]);
}

function detailValueClass(row: DisplayDetailRow): string | undefined {
  const classes = [
    row.cap ? styles.detailCap : "",
    row.mono ? styles.detailMono : "",
  ].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

function mapRows(data: unknown[]): HubAppointmentRow[] {
  return data.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o.id),
      status: String(o.status),
      starts_at: String(o.starts_at),
      created_at: String(o.created_at),
      updated_at: String(o.updated_at),
      provider_name:
        o.provider_name == null ? null : String(o.provider_name),
      ola_redirect_url:
        o.ola_redirect_url == null ? null : String(o.ola_redirect_url),
      ola_popup_message:
        o.ola_popup_message == null ? null : String(o.ola_popup_message),
      ola_order_guid:
        o.ola_order_guid == null ? null : String(o.ola_order_guid),
    };
  });
}

async function loadAppointmentsFromSupabase(): Promise<{
  rows: HubAppointmentRow[];
  error: string | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { rows: [], error: null };
  }
  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, starts_at, created_at, updated_at, provider_name, ola_redirect_url, ola_popup_message, ola_order_guid")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: mapRows(data ?? []), error: null };
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatWhenShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatListTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ordinalDay(day: number) {
  if (day > 3 && day < 21) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatListDate(iso: string) {
  try {
    const date = new Date(iso);
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    const month = date.toLocaleDateString(undefined, { month: "long" });
    return `${weekday}, ${month} ${ordinalDay(date.getDate())}`;
  } catch {
    return iso;
  }
}

export function HubAppointments({
  initial,
  serverLoadError,
}: {
  initial: HubAppointmentRow[];
  serverLoadError: string | null;
}) {
  const [items, setItems] = useState(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubAppointmentRow | null>(null);
  const [orderDetailsByGuid, setOrderDetailsByGuid] = useState<Record<string, OrderDetailState>>({});
  const orderDetailRequests = useRef(new Set<string>());
  const selectedOrderGuid = selected?.ola_order_guid ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { rows, error: e } = await loadAppointmentsFromSupabase();
      if (cancelled) {
        return;
      }
      if (e) {
        setLoadError(e);
        return;
      }
      setLoadError(null);
      setItems(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDetail();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, closeDetail]);

  useEffect(() => {
    if (!selectedOrderGuid || orderDetailRequests.current.has(selectedOrderGuid)) {
      return;
    }

    orderDetailRequests.current.add(selectedOrderGuid);
    setOrderDetailsByGuid((current) => ({
      ...current,
      [selectedOrderGuid]: {
        loading: true,
        error: null,
        payload: null,
      },
    }));

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Sign in again to load provider details.");
        }

        const response = await fetchVendorOlaOrderDetails(
          session.access_token,
          selectedOrderGuid,
        );
        const payload = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          throw new Error(
            responseMessage(payload) ??
              `Provider details could not load (${response.status}).`,
          );
        }

        setOrderDetailsByGuid((current) => ({
          ...current,
          [selectedOrderGuid]: {
            loading: false,
            error: null,
            payload,
          },
        }));
      } catch (err) {
        setOrderDetailsByGuid((current) => ({
          ...current,
          [selectedOrderGuid]: {
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Provider details could not load.",
            payload: null,
          },
        }));
      }
    })();
  }, [selectedOrderGuid]);

  const displayError = serverLoadError ?? loadError;

  if (displayError) {
    return <p className={styles.error}>{displayError}</p>;
  }

  const visitCount = items.length;
  const selectedOrderState = selectedOrderGuid
    ? orderDetailsByGuid[selectedOrderGuid]
    : null;
  const selectedOrderRows = selectedOrderState?.payload
    ? orderDetailRows(selectedOrderState.payload)
    : [];

  return (
    <>
      {visitCount > 0 ? (
        <div className={styles.listToolbar}>
          <p className={styles.listHeading}>Your list</p>
          <span className={styles.badge}>
            {visitCount} {visitCount === 1 ? "appointment" : "appointments"}
          </span>
        </div>
      ) : null}

      {visitCount === 0 ? (
        <p className={styles.emptyState}>
          No appointments yet.
        </p>
      ) : (
        <ul className={styles.visitList}>
          {items.map((r) => (
            <li key={r.id} className={styles.visitRow}>
              <button
                type="button"
                className={`${styles.visitItem} ${styles.visitItemButton}`}
                onClick={() => {
                  setSelected(r);
                }}
              >
                <div className={styles.visitTop}>
                  <div className={styles.visitLeft}>
                    <div className={styles.visitRowLine}>
                      <span className={styles.statusPill}>
                        {r.status === "booked" ? "Confirmed" : r.status}
                      </span>
                      <span className={styles.visitProviderBlock}>
                        <span className={styles.visitDoctor}>
                          {r.provider_name?.trim() || "Provider not set"}
                        </span>
                        <span className={styles.visitSubtitle}>
                          Initial semaglutide consultation
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className={styles.visitTimeBlock}>
                    <span className={styles.visitTime}>{formatListTime(r.starts_at)}</span>
                    <span className={styles.visitDate}>{formatListDate(r.starts_at)}</span>
                  </div>
                </div>
              </button>
              {r.ola_redirect_url ? (
                <a
                  className={styles.nextStepsLink}
                  href={`/ola-handoff/${encodeURIComponent(r.id)}`}
                >
                  <span className={styles.nextStepsText}>Next Steps</span>
                  <span className={styles.nextStepsChevron} aria-hidden="true" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetail();
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appt-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="appt-detail-title" className={styles.modalTitle}>
              Appointment details
            </h3>

            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt>Scheduled</dt>
                <dd>{formatWhen(selected.starts_at)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Clinician</dt>
                <dd>{selected.provider_name?.trim() || "—"}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Status</dt>
                <dd className={styles.detailCap}>{selected.status}</dd>
              </div>
              {selected.ola_redirect_url ? (
                <div className={styles.detailRow}>
                  <dt>Next steps</dt>
                  <dd>
                    <a
                      className={styles.detailLink}
                      href={`/ola-handoff/${encodeURIComponent(selected.id)}`}
                    >
                      Open next steps
                    </a>
                  </dd>
                </div>
              ) : null}
              {selected.ola_popup_message ? (
                <div className={styles.detailRow}>
                  <dt>Service provider message</dt>
                  <dd>{selected.ola_popup_message}</dd>
                </div>
              ) : null}
              <div className={styles.detailRow}>
                <dt>Reference ID</dt>
                <dd className={styles.detailMono}>{selected.id}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Booked</dt>
                <dd>{formatWhenShort(selected.created_at)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Last updated</dt>
                <dd>{formatWhenShort(selected.updated_at)}</dd>
              </div>
            </dl>

            {selected.ola_order_guid ? (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Provider details</h4>
                {selectedOrderState?.loading ? (
                  <p className={styles.detailMuted}>Loading provider details...</p>
                ) : null}
                {selectedOrderState?.error ? (
                  <p className={styles.detailError}>
                    {selectedOrderState.error}
                  </p>
                ) : null}
                {selectedOrderState?.payload && selectedOrderRows.length === 0 ? (
                  <p className={styles.detailMuted}>
                    No additional provider details are available yet.
                  </p>
                ) : null}
                {selectedOrderRows.length > 0 ? (
                  <dl className={`${styles.detailList} ${styles.detailListCompact}`}>
                    {selectedOrderRows.map((row) => (
                      <div key={`${row.label}-${row.value}`} className={styles.detailRow}>
                        <dt>{row.label}</dt>
                        <dd className={detailValueClass(row)}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
