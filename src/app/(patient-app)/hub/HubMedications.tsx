"use client";

import {
  fetchVendorOlaOrderDetails,
  fetchVendorOlaPharmacies,
} from "@/lib/api/vendorOla";
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

type PharmacyRow = {
  key: string;
  name: string;
  address: string;
  phone: string | null;
  fax: string | null;
  ncpdpId: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ViewMode = "medications" | "pharmacy";

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

function numberValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

function pharmacyRowsFromResponse(json: unknown): PharmacyRow[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const result = (json as Record<string, unknown>).result;
  if (!Array.isArray(result)) {
    return [];
  }

  return result.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const name = stringValue(record, ["StoreName", "pharmacy_name", "name"]);
    if (!name) {
      return [];
    }
    const cityStateZip = [
      stringValue(record, ["City"]),
      stringValue(record, ["State"]),
      stringValue(record, ["ZipCode"]),
    ]
      .filter(Boolean)
      .join(", ");
    const address = [
      stringValue(record, ["Address1"]),
      stringValue(record, ["Address2"]),
      cityStateZip,
    ]
      .filter(Boolean)
      .join(" ");

    return [{
      key: stringValue(record, ["NCPDPID"]) ?? `${name}-${index}`,
      name,
      address,
      phone: stringValue(record, ["PrimaryPhone"]),
      fax: stringValue(record, ["PrimaryFax"]),
      ncpdpId: stringValue(record, ["NCPDPID"]),
      latitude: numberValue(record, "Latitude"),
      longitude: numberValue(record, "Longitude"),
    }];
  });
}

function mapSrc(latitude: number, longitude: number): string {
  const latDelta = 0.035;
  const lngDelta = 0.045;
  const bbox = [
    longitude - lngDelta,
    latitude - latDelta,
    longitude + lngDelta,
    latitude + latDelta,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function zipFromReverseGeocode(json: unknown): string | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const address = (json as Record<string, unknown>).address;
  if (!address || typeof address !== "object") {
    return null;
  }
  const postcode = (address as Record<string, unknown>).postcode;
  return typeof postcode === "string" ? postcode.split("-")[0] : null;
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
  const [mode, setMode] = useState<ViewMode>("medications");
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(orderAppointments.length > 0);
  const [error, setError] = useState<string | null>(serverLoadError);
  const [pharmacyName, setPharmacyName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationPoint, setLocationPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyRow[]>([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

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

  async function requestZipFromLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Enter your ZIP code to search nearby pharmacies.");
      return;
    }

    setLocationStatus("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocationPoint(point);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(point.lat)}&lon=${encodeURIComponent(point.lng)}`,
          );
          const json = (await res.json().catch(() => null)) as unknown;
          const nextZip = zipFromReverseGeocode(json);
          if (nextZip) {
            setZipCode(nextZip);
            setLocationStatus(`Using ZIP ${nextZip} from your current location.`);
          } else {
            setLocationStatus("Enter your ZIP code to search nearby pharmacies.");
          }
        } catch {
          setLocationStatus("Enter your ZIP code to search nearby pharmacies.");
        }
      },
      () => {
        setLocationStatus("Enter your ZIP code to search nearby pharmacies.");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  function openPharmacyFinder() {
    setMode("pharmacy");
    if (!zipCode) {
      void requestZipFromLocation();
    }
  }

  async function searchPharmacies() {
    const name = pharmacyName.trim();
    const zip = zipCode.trim();
    if (name.length < 3 || !zip) {
      setPharmacyError("Enter a pharmacy name and ZIP code.");
      return;
    }

    setPharmacyLoading(true);
    setPharmacyError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setPharmacyError("Sign in again to search pharmacies.");
      setPharmacyLoading(false);
      return;
    }

    const response = await fetchVendorOlaPharmacies(session.access_token, {
      pharmacyName: name,
      zipCode: zip,
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      setPharmacyError(raw || "Could not search pharmacies.");
      setPharmacyLoading(false);
      return;
    }

    const json = (await response.json().catch(() => null)) as unknown;
    const rows = pharmacyRowsFromResponse(json);
    setPharmacies(rows);
    setPharmacyLoading(false);
    if (rows.length === 0) {
      setPharmacyError("No pharmacies found for that search.");
    }
  }

  const firstMappedPharmacy = pharmacies.find(
    (pharmacy) => pharmacy.latitude != null && pharmacy.longitude != null,
  );
  const mapPoint = firstMappedPharmacy
    ? { lat: firstMappedPharmacy.latitude!, lng: firstMappedPharmacy.longitude! }
    : locationPoint;

  if (mode === "pharmacy") {
    return (
      <>
        <div className={styles.panelHeaderRow}>
          <div className={styles.panelTitleGroup}>
            <button
              type="button"
              className={styles.backIconButton}
              aria-label="Back to medications"
              onClick={() => setMode("medications")}
            >
              <span aria-hidden="true" />
            </button>
            <h2 id="medications-title" className={styles.panelTitle}>
              Pharmacy Finder
            </h2>
          </div>
        </div>

        <div className={styles.pharmacyFinder}>
          <div className={styles.mapFrame}>
            {mapPoint ? (
              <iframe
                title="Nearby pharmacy map"
                src={mapSrc(mapPoint.lat, mapPoint.lng)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className={styles.mapPlaceholder}>
                <span className={styles.mapPlaceholderIcon} aria-hidden="true" />
                <p>Map will center after location or search.</p>
              </div>
            )}
          </div>

          <div className={styles.pharmacySearchGrid}>
            <label className={styles.finderLabel}>
              Pharmacy name
              <input
                value={pharmacyName}
                onChange={(e) => setPharmacyName(e.target.value)}
                placeholder="CVS, Walgreens, Walmart"
              />
            </label>
            <label className={styles.finderLabel}>
              ZIP code
              <input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                inputMode="numeric"
                placeholder="ZIP"
              />
            </label>
            <button
              type="button"
              className={styles.finderSearchButton}
              disabled={pharmacyLoading}
              onClick={() => {
                void searchPharmacies();
              }}
            >
              {pharmacyLoading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className={styles.finderUtilityRow}>
            <button type="button" onClick={() => void requestZipFromLocation()}>
              Use current location
            </button>
            {locationStatus ? <span>{locationStatus}</span> : null}
          </div>

          {pharmacyError ? (
            <p className={styles.error}>{pharmacyError}</p>
          ) : null}

          {pharmacies.length > 0 ? (
            <ul className={styles.pharmacyList}>
              {pharmacies.map((pharmacy) => (
                <li key={pharmacy.key} className={styles.pharmacyItem}>
                  <div>
                    <p className={styles.pharmacyName}>{pharmacy.name}</p>
                    <p className={styles.pharmacyAddress}>{pharmacy.address}</p>
                    <p className={styles.pharmacyMeta}>
                      {[
                        pharmacy.phone ? `Phone ${pharmacy.phone}` : null,
                        pharmacy.fax ? `Fax ${pharmacy.fax}` : null,
                        pharmacy.ncpdpId ? `NCPDP ${pharmacy.ncpdpId}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.panelHeaderRow}>
        <h2 id="medications-title" className={styles.panelTitle}>
          Medications
        </h2>
        <button
          type="button"
          className={styles.mapIconButton}
          aria-label="Find a pharmacy"
          onClick={openPharmacyFinder}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading current medications...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : medications.length === 0 ? (
        <p className={styles.emptyState}>No current prescriptions.</p>
      ) : (
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
      )}
    </>
  );
}
