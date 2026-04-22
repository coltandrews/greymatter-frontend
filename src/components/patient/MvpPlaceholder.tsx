/** Shared shell for patient MVP routes that are not built yet. */
export function MvpPlaceholder({
  title,
  description,
  sowRef,
}: {
  title: string;
  description: string;
  sowRef?: string;
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>{title}</h1>
      <p style={{ margin: "0 0 16px", fontSize: 15, color: "#475569", lineHeight: 1.5 }}>
        {description}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "#94a3b8",
          lineHeight: 1.5,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px dashed #cbd5e1",
          background: "#fff",
        }}
      >
        Placeholder for MVP scaffolding — we will wire this to Supabase and the API next.
        {sowRef ? ` SOW: ${sowRef}.` : null}
      </p>
    </div>
  );
}
