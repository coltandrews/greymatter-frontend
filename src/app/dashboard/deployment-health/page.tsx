import { redirect } from "next/navigation";

export default function DeploymentHealthRedirect() {
  redirect("/dashboard/app-health");
}
