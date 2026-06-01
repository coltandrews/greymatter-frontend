import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PatientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
