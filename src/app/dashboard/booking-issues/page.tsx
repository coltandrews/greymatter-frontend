import { redirect } from "next/navigation";

export default function BookingIssuesRedirect() {
  redirect("/dashboard/appointments");
}
