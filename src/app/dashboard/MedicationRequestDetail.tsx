"use client";

import {
  fetchAuditEvents,
  fetchBookingRequestDetail,
  type AuditEvent,
  type BookingRequestDetailResponse,
  type BookingRequestDocument,
} from "@/lib/api/admin";
import {
  reconcileBookingIntentStripe,
  retryBookingIntentOla,
} from "@/lib/api/bookingIntents";
import { bookingQueueReference, bookingQueueTreatmentLabel } from "@/lib/dashboard/bookingQueue";
import {
  auditEventLabel,
  auditEventSummary,
  auditEventWhen,
} from "@/lib/dashboard/auditTrail";
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

type TimelineStep = {
  label: string;
  detail: string;
  when: string;
  state: "complete" | "current" | "blocked" | "pending";
};

type DebugEnvelope = {
  headers: unknown;
  payload: unknown;
  response: unknown;
};

type ProviderAttempt = {
  id: string;
  label: string;
  summary: string | null;
  when: string;
  tone: "success" | "error" | "neutral";
  status: string;
  debug: DebugEnvelope | null;
};

const providerAttemptActionFilters = [
  "stripe_payment_ola_booking",
  "stripe_patient_reconcile",
  "stripe_reconcile",
  "ola_retry",
];

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

function debugJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
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

function latestDate(values: Array<string | null | undefined>): string | null {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sorted[0] ?? null;
}

function requestStatusSummary(detail: BookingRequestDetailResponse) {
  const { request } = detail;
  if (request.paymentStatus === "pending") {
    return {
      title: "Payment pending",
      body: "Stripe checkout has started but the app has not recorded a paid checkout yet.",
      action: "Use Reconcile Payment after confirming the session is paid in Stripe.",
      state: "blocked" as const,
    };
  }
  if (request.paymentStatus !== "paid") {
    return {
      title: "Payment not complete",
      body: "This request has not moved into the paid provider handoff flow.",
      action: "The patient needs to complete payment before provider handoff.",
      state: "pending" as const,
    };
  }
  if (!request.idDocumentStatus.complete) {
    return {
      title: "ID upload incomplete",
      body: "Provider handoff requires front and back government ID uploads.",
      action: "Ask the patient to upload both sides of their ID.",
      state: "blocked" as const,
    };
  }
  if (!request.shippingComplete) {
    return {
      title: "Shipping address incomplete",
      body: "The request is missing a complete shipping address for medication fulfillment.",
      action: "Ask the patient to update their shipping address.",
      state: "blocked" as const,
    };
  }
  if (request.bookingStatus === "needs_review") {
    return {
      title: "Provider review pending",
      body: "The request is waiting on a response from the provider network.",
      action: "No staff action is needed unless Ola reports a required correction or the request stays stuck.",
      state: "current" as const,
    };
  }
  if (request.bookingStatus === "action_required" || request.hasNextSteps) {
    return {
      title: "Patient action required",
      body: "Ola accepted the request and returned next steps for the patient.",
      action: "Confirm the patient receives the follow-up instructions.",
      state: "current" as const,
    };
  }
  if (request.olaStatus === "booked" || request.olaOrderGuid) {
    return {
      title: "Provider handoff complete",
      body: "The request has been sent to Ola and is available for provider review.",
      action: "Monitor provider status updates and patient communication.",
      state: "complete" as const,
    };
  }
  return {
    title: "Ready for provider handoff",
    body: "Payment and required request data are present, but provider handoff is not complete.",
    action: "Retry provider handoff if this request is stuck.",
    state: "current" as const,
  };
}

function requestTimeline(detail: BookingRequestDetailResponse): TimelineStep[] {
  const { request } = detail;
  const idUploadedAt = latestDate(detail.documents.map((document) => document.createdAt));
  const idSentAt = latestDate(detail.documents.map((document) => document.sentToOlaAt));
  const handoffComplete = request.olaStatus === "booked" || Boolean(request.olaOrderGuid);
  const providerReviewPending = request.bookingStatus === "needs_review";

  return [
    {
      label: "Intake submitted",
      detail: "Patient intake and treatment selection were captured.",
      when: formatDateTime(request.createdAt),
      state: "complete",
    },
    {
      label: "ID uploaded",
      detail: request.idDocumentStatus.complete
        ? "Front and back government ID are on file."
        : "Front and back government ID are required.",
      when: request.idDocumentStatus.complete ? formatDateTime(idUploadedAt) : "Waiting",
      state: request.idDocumentStatus.complete ? "complete" : "blocked",
    },
    {
      label: "Payment",
      detail: request.paymentStatus === "paid"
        ? "Payment is recorded."
        : "Payment must complete before handoff.",
      when: request.paymentStatus === "paid" ? formatDateTime(detail.paidAt) : statusLabel(request.paymentStatus),
      state: request.paymentStatus === "paid"
        ? "complete"
        : request.paymentStatus === "pending"
          ? "current"
          : "pending",
    },
    {
      label: "Provider handoff",
      detail: handoffComplete
        ? "Request was accepted by Ola."
        : providerReviewPending
          ? "Waiting for provider network response."
          : "Request has not been accepted by Ola yet.",
      when: handoffComplete ? formatDateTime(idSentAt ?? request.updatedAt) : providerReviewPending ? "Provider review" : "Waiting",
      state: handoffComplete ? "complete" : providerReviewPending ? "current" : "pending",
    },
    {
      label: "Provider review",
      detail: handoffComplete
        ? "Provider review is in progress or complete with Ola."
        : "Provider review starts after handoff.",
      when: handoffComplete ? medicationRequestAgeLabel(request.updatedAt) : "Waiting",
      state: handoffComplete ? "current" : "pending",
    },
  ];
}

function statusLabel(value: string | null | undefined): string {
  return value?.replace(/_/g, " ") || "Not started";
}

function debugEnvelopeFromMetadata(metadata: unknown): DebugEnvelope | null {
  const root = asRecord(metadata);
  const debug = asRecord(root._debug);
  const ola = asRecord(debug.ola);
  if (!Object.keys(ola).length) {
    return null;
  }
  return {
    headers: ola.headers ?? {},
    payload: ola.payload ?? {},
    response: ola.response ?? {},
  };
}

function debugEnvelopeFromVendorMetadata(metadata: unknown): DebugEnvelope | null {
  return debugEnvelopeFromMetadata(metadata);
}

function metadataMessage(metadata: unknown): string | null {
  const root = asRecord(metadata);
  const debug = debugEnvelopeFromMetadata(metadata);
  const response = asRecord(debug?.response);
  const responseJson = asRecord(response.json);
  return (
    stringValue(root, "reason") ??
    stringValue(responseJson, "error") ??
    stringValue(responseJson, "message") ??
    stringValue(root, "error") ??
    stringValue(root, "message")
  );
}

function attemptTone(action: string, metadata: unknown): ProviderAttempt["tone"] {
  const debug = debugEnvelopeFromMetadata(metadata);
  const response = asRecord(debug?.response);
  if (response.ok === true) {
    return "success";
  }
  if (response.ok === false) {
    return "error";
  }
  if (
    action.includes("failed") ||
    action.includes("needs_review") ||
    action.includes("error")
  ) {
    return "error";
  }
  if (action.includes("succeeded") || action.includes("completed")) {
    return "success";
  }
  return "neutral";
}

function attemptStatus(action: string, metadata: unknown): string {
  const debug = debugEnvelopeFromMetadata(metadata);
  const response = asRecord(debug?.response);
  if (typeof response.status === "number") {
    return response.ok === false ? `Error ${response.status}` : `OK ${response.status}`;
  }
  const tone = attemptTone(action, metadata);
  if (tone === "success") {
    return "Success";
  }
  if (tone === "error") {
    return "Error";
  }
  return "Recorded";
}

function providerAttempts(
  detail: BookingRequestDetailResponse,
  events: AuditEvent[],
): ProviderAttempt[] {
  const attempts = events
    .filter((event) =>
      providerAttemptActionFilters.some((action) => event.action.includes(action)),
    )
    .map((event) => {
      const debug = debugEnvelopeFromMetadata(event.metadata);
      const summary =
        event.note?.trim() ||
        metadataMessage(event.metadata) ||
        auditEventSummary(event);
      return {
        id: event.id,
        label: auditEventLabel(event),
        summary,
        when: auditEventWhen(event),
        tone: attemptTone(event.action, event.metadata),
        status: attemptStatus(event.action, event.metadata),
        debug,
      } satisfies ProviderAttempt;
    });

  const currentDebug = debugEnvelopeFromVendorMetadata(detail.vendorMetadata);
  if (detail.request.failureReason || currentDebug) {
    attempts.unshift({
      id: `current-${detail.request.id}`,
      label: detail.request.failureReason ? "Latest provider state" : "Latest provider response",
      summary:
        detail.request.failureReason ||
        metadataMessage(detail.vendorMetadata) ||
        "Latest provider response is saved on this request.",
      when: medicationRequestAgeLabel(detail.request.updatedAt),
      tone: detail.request.failureReason ? "error" : "neutral",
      status: detail.request.failureReason ? "Current error" : "Current",
      debug: currentDebug,
    });
  }

  return attempts;
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
    </article>
  );
}

function DebugModal({
  attempt,
  onClose,
}: {
  attempt: ProviderAttempt;
  onClose: () => void;
}) {
  const response = asRecord(attempt.debug?.response);
  const responseStatus =
    typeof response.status === "number"
      ? `${response.status}${typeof response.statusText === "string" ? ` ${response.statusText}` : ""}`
      : attempt.status;
  return (
    <div className={styles.debugModalBackdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.debugModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="debug-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.debugModalHeader}>
          <div>
            <span className={`${styles.attemptStatus} ${styles[`attemptStatus${attempt.tone}`]}`}>
              {responseStatus}
            </span>
            <h3 id="debug-modal-title">{attempt.label}</h3>
            <p>{attempt.summary ?? "Provider handoff attempt recorded."}</p>
          </div>
          <button
            type="button"
            className={styles.debugModalClose}
            onClick={onClose}
            aria-label="Close debug details"
          >
            x
          </button>
        </header>
        <div className={styles.debugModalGrid}>
          <article className={styles.debugPane}>
            <h4>Headers</h4>
            <pre>{debugJson(attempt.debug?.headers)}</pre>
          </article>
          <article className={styles.debugPane}>
            <h4>Payload</h4>
            <pre>{debugJson(attempt.debug?.payload)}</pre>
          </article>
          <article className={styles.debugPane}>
            <h4>Response</h4>
            <pre>{debugJson(attempt.debug?.response)}</pre>
          </article>
        </div>
      </section>
    </div>
  );
}

export function MedicationRequestDetail({ bookingIntentId }: Props) {
  const [detail, setDetail] = useState<BookingRequestDetailResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [debugAttempt, setDebugAttempt] = useState<ProviderAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"retry-ola" | "reconcile-stripe" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    setAuditEvents([]);
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
      const payload = await response.json() as BookingRequestDetailResponse;
      setDetail(payload);
      const auditResponse = await fetchAuditEvents(session.access_token, {
        bookingIntentId,
        patientUserId: payload.request.userId,
        limit: 20,
      });
      if (auditResponse.ok) {
        const auditPayload = await auditResponse.json() as { events?: AuditEvent[] };
        setAuditEvents(auditPayload.events ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medication request.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [bookingIntentId]);

  useEffect(() => {
    if (!debugAttempt) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDebugAttempt(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [debugAttempt]);

  async function sessionToken(): Promise<string> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sign in again to run this action.");
    }
    return session.access_token;
  }

  async function runAction(kind: "retry-ola" | "reconcile-stripe") {
    if (acting) {
      return;
    }

    setActing(kind);
    setActionMessage(null);
    setError(null);
    try {
      const token = await sessionToken();
      const response =
        kind === "retry-ola"
          ? await retryBookingIntentOla(token, bookingIntentId)
          : await reconcileBookingIntentStripe(token, bookingIntentId);
      if (!response.ok) {
        throw new Error(await readBackendMessage(response));
      }
      setActionMessage(
        kind === "retry-ola"
          ? "Provider handoff retried."
          : "Payment status reconciled.",
      );
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActing(null);
    }
  }

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
  const canRetryOla =
    request.paymentStatus === "paid" && request.bookingStatus === "needs_review";
  const canReconcileStripe =
    request.paymentStatus === "pending" && Boolean(detail.stripeCheckoutSessionId?.trim());
  const summary = requestStatusSummary(detail);
  const timeline = requestTimeline(detail);
  const attempts = providerAttempts(detail, auditEvents);

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

      <section className={`${styles.requestStatusCallout} ${styles[`requestStatusCallout${summary.state}`]}`}>
        <div>
          <p className={styles.requestStatusEyebrow}>
            {summary.state === "blocked" ? "Current blocker" : "Current status"}
          </p>
          <h3>{summary.title}</h3>
          <p>{summary.body}</p>
        </div>
        <strong>{summary.action}</strong>
      </section>

      <section className={styles.requestDetailPanel}>
        <div className={styles.documentSectionHeader}>
          <div>
            <h3>Request Timeline</h3>
            <p>Key events from intake through provider review.</p>
          </div>
        </div>
        <ol className={styles.requestTimeline}>
          {timeline.map((step) => (
            <li key={step.label} className={`${styles.timelineStep} ${styles[`timelineStep${step.state}`]}`}>
              <span className={styles.timelineDot} />
              <div>
                <div className={styles.timelineStepHeader}>
                  <h4>{step.label}</h4>
                  <time>{step.when}</time>
                </div>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.requestDetailGrid}>
        <section className={styles.requestDetailPanel}>
          <div className={styles.documentSectionHeader}>
            <div>
              <h3>Actions</h3>
              <p>Use these when payment or provider handoff needs manual recovery.</p>
            </div>
          </div>
          <div className={styles.detailActionGrid}>
            <button
              type="button"
              className={styles.detailActionButton}
              onClick={() => void runAction("retry-ola")}
              disabled={!canRetryOla || Boolean(acting)}
            >
              {acting === "retry-ola" ? "Retrying..." : "Retry Provider Handoff"}
            </button>
            <button
              type="button"
              className={styles.detailActionButton}
              onClick={() => void runAction("reconcile-stripe")}
              disabled={!canReconcileStripe || Boolean(acting)}
            >
              {acting === "reconcile-stripe" ? "Checking..." : "Reconcile Payment"}
            </button>
          </div>
          <p className={styles.detailActionHint}>
            Provider retry is available for paid requests under review. Payment reconcile is available for pending checkouts.
          </p>
          {actionMessage ? (
            <p
              className={
                actionMessage.includes("retried") || actionMessage.includes("reconciled")
                  ? styles.actionMessage
                  : styles.actionError
              }
            >
              {actionMessage}
            </p>
          ) : null}
        </section>

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

      <section className={styles.requestDetailPanel}>
        <div className={styles.documentSectionHeader}>
          <div>
            <h3>Provider Handoff Audit</h3>
            <p>Every payment-to-provider attempt we have on this request.</p>
          </div>
        </div>
        {attempts.length > 0 ? (
          <ul className={styles.attemptList}>
            {attempts.map((attempt) => (
              <li key={attempt.id} className={styles.attemptItem}>
                <div>
                  <span className={`${styles.attemptStatus} ${styles[`attemptStatus${attempt.tone}`]}`}>
                    {attempt.status}
                  </span>
                  <strong>{attempt.label}</strong>
                  {attempt.summary ? <span>{attempt.summary}</span> : null}
                  <time>{attempt.when}</time>
                </div>
                {attempt.debug ? (
                  <button
                    type="button"
                    className={styles.debugLinkButton}
                    onClick={() => setDebugAttempt(attempt)}
                  >
                    View debug
                  </button>
                ) : (
                  <span className={styles.debugUnavailable}>No debug payload</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyText}>No provider handoff attempts have been recorded.</p>
        )}
      </section>

      <AuditTrailPanel
        excludeActionIncludes={providerAttemptActionFilters}
        title="Other request activity"
        target={{
          patientUserId: request.userId,
          bookingIntentId: request.id,
        }}
      />

      {debugAttempt ? (
        <DebugModal attempt={debugAttempt} onClose={() => setDebugAttempt(null)} />
      ) : null}
    </div>
  );
}
