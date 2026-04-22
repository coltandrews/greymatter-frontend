"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({
  noMargin,
  menuItem,
}: {
  noMargin?: boolean;
  /** Full-width row for header dropdowns */
  menuItem?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  const style = menuItem
    ? {
        marginTop: 0,
        width: "100%" as const,
        textAlign: "left" as const,
        padding: "10px 12px",
        borderRadius: 8,
        border: "none",
        background: "transparent",
        color: "#b91c1c",
        fontSize: 14,
        fontWeight: 600,
        cursor: loading ? ("not-allowed" as const) : ("pointer" as const),
      }
    : {
        marginTop: noMargin ? 0 : 16,
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#172033",
        fontSize: 14,
        fontWeight: 600,
        cursor: loading ? ("not-allowed" as const) : ("pointer" as const),
      };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      style={style}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
