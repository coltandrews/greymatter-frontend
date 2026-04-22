import { createClient } from "@/lib/supabase/server";
import { IntakeWizard } from "@/app/intake/IntakeWizard";

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#172033" }}>Intake</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
        Answer a few questions so we can route you correctly.
      </p>
      <div
        style={{
          padding: 28,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5ebf5",
        }}
      >
        <IntakeWizard />
      </div>
    </div>
  );
}
