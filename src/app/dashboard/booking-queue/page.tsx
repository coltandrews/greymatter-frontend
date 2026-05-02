import { redirect } from "next/navigation";

export default function BookingQueueRedirect() {
  redirect("/dashboard/appointments");
}
