"use client";

import { fetchVendorOlaOrderDetails } from "@/lib/api/vendorOla";
import { hubBookingIntentStatusView } from "@/lib/scheduling/hubBookingStatus";
import { createClient } from "@/lib/supabase/client";
import { treatmentByKey } from "@/lib/treatments";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./hub.module.css";
import type { HubAppointmentRow, HubBookingIntentRow } from "./HubAppointments";

type MedicationRow = {
  key: string;
  name: string;
  details: string | null;
  source: string | null;
  status: string;
  statusTone: string;
  href: string;
};

function stringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

function prescriptionToMedication(
  prescription: unknown,
  sourceRow: { id: string; href: string; providerName: string | null },
  index: number,
): MedicationRow | null {
  if (typeof prescription === "string" && prescription.trim()) {
    return {
      key: `${sourceRow.id}-${index}-${prescription}`,
      name: prescription.trim(),
      details: null,
      source: sourceRow.providerName?.trim() || null,
      status: "In review",
      statusTone: "pending",
      href: sourceRow.href,
    };
  }

  if (!prescription || typeof prescription !== "object") {
    return null;
  }

  const record = prescription as Record<string, unknown>;
  const nestedMedication =
    record.medication && typeof record.medication === "object"
      ? (record.medication as Record<string, unknown>)
      : null;
  const name =
    stringValue(record, [
      "medication_name",
      "medicationName",
      "drug_name",
      "drugName",
      "display_name",
      "product_name",
      "prescription_name",
      "name",
      "description",
    ]) ??
    (nestedMedication
      ? stringValue(nestedMedication, ["name", "display_name", "drug_name", "description"])
      : null);

  if (!name) {
    return null;
  }

  const details = [
    stringValue(record, ["dosage", "dose", "strength"]),
    stringValue(record, ["sig", "directions", "instructions"]),
    stringValue(record, ["status"]),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    key: `${sourceRow.id}-${index}-${name}`,
    name,
    details: details || null,
    source: sourceRow.providerName?.trim() || null,
    status: stringValue(record, ["status"]) ?? "In review",
    statusTone: "pending",
    href: sourceRow.href,
  };
}

function prescriptionsFromOrderDetails(json: unknown): unknown[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const root = json as Record<string, unknown>;
  const result = root.result;
  if (!result || typeof result !== "object") {
    return [];
  }
  const prescriptions = (result as Record<string, unknown>).prescriptions;
  return Array.isArray(prescriptions) ? prescriptions : [];
}

function selectedTreatmentName(row: HubBookingIntentRow): string {
  const intake =
    row.intake_data && typeof row.intake_data === "object"
      ? (row.intake_data as Record<string, unknown>)
      : {};
  const treatmentKey =
    typeof intake.selected_treatment === "string"
      ? intake.selected_treatment
      : null;
  return treatmentByKey(treatmentKey)?.name ?? "Medication request";
}

function dedupeMedications(rows: MedicationRow[]): MedicationRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.name.toLowerCase()}|${(row.details ?? "").toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function HubMedications({
  appointments,
  bookingIntents,
  serverLoadError,
}: {
  appointments: HubAppointmentRow[];
  bookingIntents: HubBookingIntentRow[];
  serverLoadError: string | null;
}) {
  const orderRows = useMemo(
    () => [
      ...bookingIntents
        .filter((row) => row.ola_order_guid)
        .map((row) => ({
          id: row.id,
          href: `/hub/medications/booking/${encodeURIComponent(row.id)}`,
          orderGuid: row.ola_order_guid as string,
          providerName: null,
        })),
      ...appointments
        .filter((appt) => appt.ola_order_guid)
        .map((appt) => ({
          id: appt.id,
          href: `/hub/medications/appointment/${encodeURIComponent(appt.id)}`,
          orderGuid: appt.ola_order_guid as string,
          providerName: appt.provider_name,
        })),
    ],
    [appointments, bookingIntents],
  );
  const requestRows = useMemo(
    () =>
      bookingIntents.map((row): MedicationRow => {
        const view = hubBookingIntentStatusView({
          booking_status: row.booking_status,
          payment_status: row.payment_status,
          ola_status: row.ola_status,
        });
        return {
          key: `request-${row.id}`,
          name: selectedTreatmentName(row),
          details: view.subtitle,
          source: row.ola_order_guid ? `Ola ${row.ola_order_guid}` : null,
          status:
            row.booking_status === "booked" || row.booking_status === "action_required"
              ? "Provider review"
              : view.label,
          statusTone: view.tone,
          href: `/hub/medications/booking/${encodeURIComponent(row.id)}`,
        };
      }),
    [bookingIntents],
  );
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(orderRows.length > 0);
  const [error, setError] = useState<string | null>(serverLoadError);

  useEffect(() => {
    let cancelled = false;

    async function loadMedications() {
      if (serverLoadError) {
        setError(serverLoadError);
        setLoading(false);
        return;
      }

      if (orderRows.length === 0) {
        setMedications([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setError("Sign in again to load medications.");
          setLoading(false);
        }
        return;
      }

      const loaded = await Promise.all(
        orderRows.map(async (row) => {
          const orderGuid = row.orderGuid;
          if (!orderGuid) {
            return [];
          }
          const response = await fetchVendorOlaOrderDetails(session.access_token, orderGuid);
          if (!response.ok) {
            return [];
          }
          const json = (await response.json().catch(() => null)) as unknown;
          return prescriptionsFromOrderDetails(json)
            .map((item, index) => prescriptionToMedication(item, row, index))
            .filter((item): item is MedicationRow => item != null);
        }),
      );

      if (!cancelled) {
        setMedications(dedupeMedications(loaded.flat()));
        setLoading(false);
      }
    }

    void loadMedications();
    return () => {
      cancelled = true;
    };
  }, [orderRows, serverLoadError]);

  const displayRows = dedupeMedications([...medications, ...requestRows]);

  return (
    <>
      <div className={styles.panelHeaderRow}>
        <div>
          <h2 id="medications-title" className={styles.panelTitle}>
            My medications
          </h2>
          <p className={styles.panelSubtitle}>
            Current prescriptions and active provider-reviewed requests.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading current medications...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : displayRows.length === 0 ? (
        <p className={styles.emptyState}>No medication requests yet.</p>
      ) : (
        <ul className={styles.medList}>
          {displayRows.map((med) => (
            <li key={med.key}>
              <Link href={med.href} className={styles.medItem}>
                <div className={styles.medInfo}>
                  <p className={styles.medName}>{med.name}</p>
                  {med.details ? <p className={styles.medDetails}>{med.details}</p> : null}
                </div>
                <div className={styles.medMeta}>
                  <span className={`${styles.statusPill} ${styles[`statusPill${med.statusTone}`]}`}>
                    {med.status}
                  </span>
                  {med.source ? <span className={styles.medSource}>{med.source}</span> : null}
                </div>
                <span className={styles.medMobileCta}>
                  View details
                  <span className={styles.medChevron} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
