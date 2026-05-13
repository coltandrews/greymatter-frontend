"use client";

import {
  fetchBookingRequestDetail,
  type BookingRequestDetailResponse,
  type BookingRequestDocument,
} from "@/lib/api/admin";
import { bookingQueueReference, bookingQueueTreatmentLabel } from "@/lib/dashboard/bookingQueue";
import {
  medicationRequestAgeLabel,
  medicationRequestStatusView,
  medicationRequestToneStyles,
} from "@/lib/dashboard/medicationRequests";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuditTrailPanel } from "./AuditTrailPanel";
import styles from "./dashboard.module.css";

type Props = {
  bookingIntentId: string;
};

type DetailItem = {
  label: string;
  value: string;
};

function readBackendMessage(res: Response): Promise<string> {
  return res.json()
    .catch(() => null)
    .then((body: { message?: unknown } | null) =>
      typeof body?.message === "string" && body.message.trim()
        ? body.message
        : `Medication request failed (${res.status}).`,
    );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
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

function formatCurrency(amountCents: number | null, currency: string | null) {
  if (typeof amountCents !== "number") {
    return "Not available";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(amountCents / 100);
}

function jsonSummary(value: unknown) {
  const record = asRecord(value);
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return "No metadata";
  }
  return JSON.stringify(record, null, 2);
}

function documentSideLabel(kind: string | null) {
  if (kind === "government_id_front") {
    return "Front ID";
  }
  if (kind === "government_id_back") {
    return "Back ID";
  }
  return "ID document";
}

function fileSizeLabel(sizeBytes: number | null) {
  if (!sizeBytes) {
    return "Size unavailable";
  }
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function DetailGrid({ items }: { items: DetailItem[] }) {
  return (
    <dl className={styles.detailDefinitionGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.detailDefinitionItem}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentPreview({ document }: { document: BookingRequestDocument }) {
  const isImage = document.mimeType?.startsWith("image/");
  return (
    <article className={styles.documentPreview}>
      <div className={styles.documentPreviewHeader}>
        <div>
          <h4>{documentSideLabel(document.kind)}</h4>
          <p>
            {fileSizeLabel(document.sizeBytes)}
            {document.sentToOlaAt ? ` · Sent ${formatDateTime(document.sentToOlaAt)}` : ""}
          </p>
        </div>
        <span className={styles.statusBadge}>
          {document.sentToOlaAt ? "Sent" : "Uploaded"}
        </span>
      </div>
      {document.signedUrl && isImage ? (
        <img
          src={document.signedUrl}
          alt={`${documentSideLabel(document.kind)} preview`}
          className={styles.documentImage}
        />
      ) : document.signedUrl ? (
        <a
          href={document.signedUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.documentFileLink}
        >
          Open uploaded document
        </a>
      ) : (
        <p className={styles.documentMissing}>Preview unavailable.</p>
      )}
    </article>
  );
}

export function MedicationRequestDetail({ bookingIntentId }: Props) {
  const [detail, setDetail] = useState<BookingRequestDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in again to load this request.");
      }
      const response = await fetchBookingRequestDetail(session.access_token, bookingIntentId);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      setDetail(await response.json() as BookingRequestDetailResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medication request.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [bookingIntentId]);

  const view = useMemo(() => {
    if (!detail) {
      return null;
    }
    return medicationRequestStatusView({
      bookingStatus: detail.request.bookingStatus,
      paymentStatus: detail.request.paymentStatus,
      olaStatus: detail.request.olaStatus,
      failureReason: detail.request.failureReason,
      hasNextSteps: detail.request.hasNextSteps,
    });
  }, [detail]);

  if (loading) {
    return (
      <section className={styles.workspaceCard}>
        <p className={styles.emptyText}>Loading medication request...</p>
      </section>
    );
  }

  if (error || !detail || !view) {
    return (
      <section className={styles.workspaceCard}>
        <Link href="/dashboard/appointments" className={styles.detailBackLink}>
          Back to Medication Requests
        </Link>
        <p role="alert" className={styles.inlineError}>
          {error ?? "Medication request was not found."}
        </p>
      </section>
    );
  }

  const { request } = detail;
  const intake = asRecord(detail.intakeData);
  const selectedSlot = asRecord(detail.selectedSlot);
  const selectedPharmacy = asRecord(detail.selectedPharmacy);
  const tone = medicationRequestToneStyles[view.tone];
  const documents = detail.documents ?? [];

  const patientItems: DetailItem[] = [
    { label: "Name", value: request.patientName },
    { label: "Email", value: request.patientEmail ?? "Not available" },
    { label: "Phone", value: request.phoneLast4 ? `SMS ending ${request.phoneLast4}` : "Not available" },
    { label: "DOB", value: stringValue(intake, "dob") ?? "Not available" },
    { label: "State", value: request.serviceState ?? "Not available" },
  ];
  const requestItems: DetailItem[] = [
    { label: "Treatment", value: bookingQueueTreatmentLabel(request) },
    { label: "Status", value: view.label },
    { label: "Payment", value: request.paymentStatus?.replace(/_/g, " ") || "Unknown" },
    { label: "Total", value: formatCurrency(detail.amountCents, detail.currency) },
    { label: "Submitted", value: formatDateTime(request.createdAt) },
    { label: "Updated", value: medicationRequestAgeLabel(request.updatedAt) },
  ];
  const shippingItems: DetailItem[] = [
    { label: "Address", value: request.shippingSummary },
    { label: "Complete", value: request.shippingComplete ? "Yes" : "No" },
  ];
  const handoffItems: DetailItem[] = [
    { label: "Reference", value: bookingQueueReference(request) },
    { label: "Ola status", value: request.olaStatus ?? "Not started" },
    { label: "Ola order", value: request.olaOrderGuid ?? "Not available" },
    { label: "Failure", value: request.failureReason ?? "None" },
    { label: "Paid", value: formatDateTime(detail.paidAt) },
    { label: "Provider", value: stringValue(selectedSlot, "providerName") ?? request.providerName ?? "Pending" },
    { label: "Slot", value: formatDateTime(stringValue(selectedSlot, "start") ?? request.slotStart) },
    { label: "Pharmacy", value: stringValue(selectedPharmacy, "name") ?? request.pharmacyName ?? "Test Pharmacy" },
  ];

  return (
    <div className={styles.detailStack}>
      <div className={styles.detailTopBar}>
        <Link href="/dashboard/appointments" className={styles.detailBackLink}>
          Back to Medication Requests
        </Link>
        <button
          type="button"
          onClick={() => void loadDetail()}
          disabled={loading}
          className={styles.smallAction}
        >
          Refresh
        </button>
      </div>

      <section className={styles.requestDetailHero}>
        <div>
          <span
            className={styles.statusBadge}
            style={{ background: tone.background, color: tone.color }}
          >
            {view.label}
          </span>
          <h2>{request.patientName}</h2>
          <p>{bookingQueueTreatmentLabel(request)}</p>
        </div>
        <div className={styles.detailReference}>
          <span>Reference</span>
          <strong>{bookingQueueReference(request)}</strong>
        </div>
      </section>

      <div className={styles.requestDetailGrid}>
        <section className={styles.requestDetailPanel}>
          <h3>Patient</h3>
          <DetailGrid items={patientItems} />
        </section>

        <section className={styles.requestDetailPanel}>
          <h3>Request</h3>
          <DetailGrid items={requestItems} />
        </section>

        <section className={styles.requestDetailPanel}>
          <h3>Shipping</h3>
          <DetailGrid items={shippingItems} />
        </section>

        <section className={styles.requestDetailPanel}>
          <h3>Provider Handoff</h3>
          <DetailGrid items={handoffItems} />
          <details className={styles.detailDisclosure}>
            <summary>Vendor metadata</summary>
            <pre>{jsonSummary(detail.vendorMetadata)}</pre>
          </details>
        </section>
      </div>

      <section className={styles.requestDetailPanel}>
        <div className={styles.documentSectionHeader}>
          <div>
            <h3>ID Documents</h3>
            <p>
              {request.idDocumentStatus.complete
                ? "Front and back ID are uploaded."
                : "Front and back ID are not complete."}
            </p>
          </div>
          <span
            className={`${styles.statusBadge} ${
              request.idDocumentStatus.complete
                ? styles.overviewBadgeOk
                : styles.overviewBadgeWarning
            }`}
          >
            {request.idDocumentStatus.sentToOla
              ? "Sent"
              : request.idDocumentStatus.complete
                ? "Uploaded"
                : "Missing"}
          </span>
        </div>
        {documents.length > 0 ? (
          <div className={styles.documentGrid}>
            {documents.map((document) => (
              <DocumentPreview key={document.id} document={document} />
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>No ID documents have been uploaded.</p>
        )}
      </section>

      <AuditTrailPanel
        title="Request audit"
        target={{
          patientUserId: request.userId,
          bookingIntentId: request.id,
        }}
      />
    </div>
  );
}
