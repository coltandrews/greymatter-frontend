function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base;
}

export type ConfigHealthStatus = "ok" | "warning" | "error";

export type ConfigHealthCheck = {
  key: string;
  label: string;
  status: ConfigHealthStatus;
  message: string;
};

export type ConfigHealthResponse = {
  status: "ok" | "degraded";
  checkedAt: string;
  checks: ConfigHealthCheck[];
};

export type BookingQueueRow = {
  id: string;
  userId: string;
  patientName: string;
  patientEmail: string | null;
  serviceState: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
  olaStatus: string | null;
  providerName: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  pharmacyName: string | null;
  pharmacyNcpdpId: string | null;
  olaOrderGuid: string | null;
  hasNextSteps: boolean;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingQueueResponse = {
  rows: BookingQueueRow[];
};

export type TransactionRow = {
  id: string;
  userId: string;
  patientName: string;
  patientEmail: string | null;
  amountCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  bookingStatus: string | null;
  serviceState: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionsResponse = {
  rows: TransactionRow[];
};

export type PatientLookupAppointment = {
  id: string;
  status: string | null;
  startsAt: string;
  providerName: string | null;
  olaOrderGuid: string | null;
  hasNextSteps: boolean;
  updatedAt: string;
};

export type PatientLookupPatient = {
  userId: string;
  email: string | null;
  name: string;
  serviceState: string | null;
  latestSubmission: {
    id: string;
    status: string | null;
    updatedAt: string;
  } | null;
  bookings: BookingQueueRow[];
  appointments: PatientLookupAppointment[];
};

export type PatientLookupResponse = {
  patients: PatientLookupPatient[];
};

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  patientUserId: string | null;
  bookingIntentId: string | null;
  appointmentId: string | null;
  action: string;
  note: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AuditEventsResponse = {
  events: AuditEvent[];
};

export type CreateAuditNoteInput = {
  patientUserId?: string | null;
  bookingIntentId?: string | null;
  appointmentId?: string | null;
  note: string;
};

export async function fetchConfigHealth(supabaseAccessToken: string) {
  return fetch(`${apiBase()}/api/admin/config-health`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchBookingQueue(
  supabaseAccessToken: string,
  limit = 100,
) {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetch(`${apiBase()}/api/admin/booking-queue?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchTransactions(
  supabaseAccessToken: string,
  limit = 100,
) {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetch(`${apiBase()}/api/admin/transactions?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchTransactionReceipt(
  supabaseAccessToken: string,
  transactionId: string,
) {
  return fetch(`${apiBase()}/api/admin/transactions/${encodeURIComponent(transactionId)}/receipt`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/pdf",
    },
  });
}

export async function fetchPatientLookup(
  supabaseAccessToken: string,
  query: string,
) {
  const search = new URLSearchParams({ q: query });
  return fetch(`${apiBase()}/api/admin/patient-lookup?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchAuditEvents(
  supabaseAccessToken: string,
  params: {
    patientUserId?: string | null;
    bookingIntentId?: string | null;
    appointmentId?: string | null;
    limit?: number;
  },
) {
  const search = new URLSearchParams();
  if (params.bookingIntentId) {
    search.set("booking_intent_id", params.bookingIntentId);
  } else if (params.appointmentId) {
    search.set("appointment_id", params.appointmentId);
  } else if (params.patientUserId) {
    search.set("patient_user_id", params.patientUserId);
  }
  search.set("limit", String(params.limit ?? 25));

  return fetch(`${apiBase()}/api/admin/audit-events?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
    },
  });
}

export async function createAuditNote(
  supabaseAccessToken: string,
  input: CreateAuditNoteInput,
) {
  return fetch(`${apiBase()}/api/admin/audit-events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
