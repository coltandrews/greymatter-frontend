import { redirect } from "next/navigation";

export default function RecoveryRedirect() {
  redirect("/dashboard/booking-issues");
}
