import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthEntry } from "./AuthEntry";

type Props = {
  searchParams: Promise<{ signin?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/post-login");
  }

  return (
    <Suspense fallback={null}>
      <AuthEntry initialMode={sp.signin === "1" || sp.signin === "true" ? "signin" : "signup"} />
    </Suspense>
  );
}
