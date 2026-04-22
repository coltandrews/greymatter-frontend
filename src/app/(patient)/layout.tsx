import { createClient } from "@/lib/supabase/server";
import { PatientSidebar } from "./PatientSidebar";
import { redirect } from "next/navigation";

export default async function PatientLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "patient";
  if (role === "staff" || role === "admin") {
    redirect("/dashboard");
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <PatientSidebar email={user.email ?? user.id} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "32px 40px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
