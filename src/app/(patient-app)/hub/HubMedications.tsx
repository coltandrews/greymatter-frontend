"use client";

import { fetchVendorOlaOrderDetails } from "@/lib/api/vendorOla";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import styles from "./hub.module.css";
import type { HubAppointmentRow } from "./HubAppointments";

type MedicationRow = {
  key: string;
  name: string;
  details: string | null;
  source: string | null;
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
  appointment: HubAppointmentRow,
  index: number,
): MedicationRow | null {
  if (typeof prescription === "string" && prescription.trim()) {
    return {
      key: `${appointment.id}-${index}-${prescription}`,
      name: prescription.trim(),
      details: null,
      source: appointment.provider_name?.trim() || null,
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
    key: `${appointment.id}-${index}-${name}`,
    name,
    details: details || null,
    source: appointment.provider_name?.trim() || null,
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
  serverLoadError,
}: {
  appointments: HubAppointmentRow[];
  serverLoadError: string | null;
}) {
  const orderAppointments = useMemo(
    () => appointments.filter((appt) => appt.ola_order_guid),
    [appointments],
  );
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(orderAppointments.length > 0);
  const [error, setError] = useState<string | null>(serverLoadError);

  useEffect(() => {
    let cancelled = false;

    async function loadMedications() {
      if (serverLoadError) {
        setError(serverLoadError);
        setLoading(false);
        return;
      }

      if (orderAppointments.length === 0) {
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
        orderAppointments.map(async (appointment) => {
          const orderGuid = appointment.ola_order_guid;
          if (!orderGuid) {
            return [];
          }
          const response = await fetchVendorOlaOrderDetails(session.access_token, orderGuid);
          if (!response.ok) {
            return [];
          }
          const json = (await response.json().catch(() => null)) as unknown;
          return prescriptionsFromOrderDetails(json)
            .map((item, index) => prescriptionToMedication(item, appointment, index))
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
  }, [orderAppointments, serverLoadError]);

  if (loading) {
    return <p className={styles.emptyState}>Loading current medications...</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (medications.length === 0) {
    return <p className={styles.emptyState}>No current prescriptions.</p>;
  }

  return (
    <ul className={styles.medList}>
      {medications.map((med) => (
        <li key={med.key} className={styles.medItem}>
          <div>
            <p className={styles.medName}>{med.name}</p>
            {med.details ? <p className={styles.medDetails}>{med.details}</p> : null}
          </div>
          {med.source ? <span className={styles.medSource}>{med.source}</span> : null}
        </li>
      ))}
    </ul>
  );
}
