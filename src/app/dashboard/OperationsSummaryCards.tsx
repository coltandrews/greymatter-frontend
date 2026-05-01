import type { BookingOperationsSummary } from "@/lib/dashboard/operationsSummary";

const cards: {
  key: keyof BookingOperationsSummary;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    key: "paymentPending",
    label: "Payment pending",
    hint: "Checkout started, not paid yet",
    accent: "#2563eb",
  },
  {
    key: "olaPending",
    label: "Paid / Ola pending",
    hint: "Payment complete, provider booking in progress",
    accent: "#7c3aed",
  },
  {
    key: "booked",
    label: "Booked",
    hint: "Payment and Ola booking complete",
    accent: "#15803d",
  },
  {
    key: "needsReview",
    label: "Needs review",
    hint: "Paid but not automatically booked",
    accent: "#c2410c",
  },
];

export function OperationsSummaryCards({
  summary,
}: {
  summary: BookingOperationsSummary;
}) {
  return (
    <section style={{ margin: "0 0 24px" }} aria-labelledby="operations-title">
      <h2 id="operations-title" style={{ margin: "0 0 12px", fontSize: 18 }}>
        Booking operations
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            style={{
              padding: 16,
              border: "1px solid #e5ebf5",
              borderRadius: 12,
              background: "#f8fafc",
              borderLeft: `4px solid ${card.accent}`,
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", fontWeight: 700 }}>
              {card.label}
            </p>
            <p style={{ margin: "0 0 6px", fontSize: 26, color: "#172033", fontWeight: 800 }}>
              {summary[card.key]}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
              {card.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
