import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { bookingOperationsSummary } from "@/lib/dashboard/operationsSummary";
import { redirect } from "next/navigation";
import { BookingQueuePanel } from "./BookingQueuePanel";
import { DashboardNav } from "./DashboardNav";
import { OperationsSummaryCards } from "./OperationsSummaryCards";
import { PatientLookupPanel } from "./PatientLookupPanel";
import { StaffRecoveryPanel } from "./StaffRecoveryPanel";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "patient";
  if (role !== "staff" && role !== "admin") {
    redirect("/hub");
  }

  const [
    { data: submissions, error: subErr },
    { data: recoveryRows, error: recoveryErr },
    { data: operationsRows, error: operationsErr },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, user_id, status, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("booking_intents")
      .select("id, user_id, payment_status, booking_status, ola_status, service_state, selected_slot, selected_pharmacy, vendor_metadata, ola_order_guid, ola_redirect_url, failure_reason, created_at, updated_at")
      .eq("payment_status", "paid")
      .eq("booking_status", "needs_review")
      .order("updated_at", { ascending: false }),
    supabase
      .from("booking_intents")
      .select("payment_status, booking_status, ola_status"),
  ]);
  const operationsSummary = bookingOperationsSummary(operationsRows ?? []);

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 960,
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Admin portal</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
          {user.email ?? user.id}
        </p>

        <DashboardNav role={role} currentPage="dashboard" />

        {subErr ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
            {subErr.message}
          </p>
        ) : null}
        {recoveryErr ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
            {recoveryErr.message}
          </p>
        ) : null}
        {operationsErr ? (
          <p role="alert" style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>
            {operationsErr.message}
          </p>
        ) : null}

        <div id="overview" style={{ scrollMarginTop: 24 }}>
          <OperationsSummaryCards summary={operationsSummary} />
        </div>

        <div id="patients" style={{ scrollMarginTop: 24 }}>
          <PatientLookupPanel />
        </div>

        <div id="booking-queue" style={{ scrollMarginTop: 24 }}>
          <BookingQueuePanel />
        </div>

        <div id="submissions" style={{ scrollMarginTop: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Submissions</h2>
          {!subErr && submissions && submissions.length > 0 ? (
            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5ebf5" }}>
                    <th style={{ padding: "10px 12px 10px 0", color: "#64748b", fontWeight: 600 }}>
                      Patient user id
                    </th>
                    <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 600 }}>
                      Status
                    </th>
                    <th style={{ padding: "10px 12px", color: "#64748b", fontWeight: 600 }}>
                      Updated
                    </th>
                    <th style={{ padding: "10px 0 10px 12px", color: "#64748b", fontWeight: 600 }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td
                        style={{
                          padding: "12px 12px 12px 0",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          color: "#172033",
                        }}
                        title={s.user_id}
                      >
                        {s.user_id}
                      </td>
                      <td style={{ padding: "12px", textTransform: "capitalize" as const }}>
                        {s.status.replace("_", " ")}
                      </td>
                      <td style={{ padding: "12px", color: "#475569" }}>{formatWhen(s.updated_at)}</td>
                      <td style={{ padding: "12px 0 12px 12px", color: "#475569" }}>
                        {formatWhen(s.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!subErr && (!submissions || submissions.length === 0) ? (
            <p style={{ margin: "0 0 20px", fontSize: 15, color: "#64748b" }}>
              No submissions yet.
            </p>
          ) : null}
        </div>

        <div id="recovery" style={{ scrollMarginTop: 24 }}>
          <StaffRecoveryPanel
            initialBookings={(recoveryRows ?? []).map((row) => ({
              id: row.id,
              user_id: row.user_id,
              payment_status: row.payment_status,
              booking_status: row.booking_status,
              ola_status: row.ola_status,
              service_state: row.service_state,
              selected_slot: row.selected_slot,
              selected_pharmacy: row.selected_pharmacy,
              vendor_metadata: row.vendor_metadata,
              ola_order_guid: row.ola_order_guid,
              ola_redirect_url: row.ola_redirect_url,
              failure_reason: row.failure_reason,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }))}
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
