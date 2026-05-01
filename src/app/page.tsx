import { Suspense } from "react";
import { PreAuthEligibility } from "./PreAuthEligibility";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PreAuthEligibility />
    </Suspense>
  );
}
