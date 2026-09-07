import { Suspense } from "react";
import { LegalDashboard } from "@/components/legal-dashboard";

export default function Home() {
  return (
    <Suspense fallback={<div className="helix-grid min-h-full" />}>
      <LegalDashboard />
    </Suspense>
  );
}
