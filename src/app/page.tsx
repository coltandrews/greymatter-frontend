import { Suspense } from "react";
import { AuthEntry } from "./AuthEntry";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthEntry />
    </Suspense>
  );
}
