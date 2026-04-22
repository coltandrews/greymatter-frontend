import { redirect } from "next/navigation";

/** Legacy path; patient home is `/hub` inside the post-intake shell. */
export default function HomeRedirectPage() {
  redirect("/hub");
}
