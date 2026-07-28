import { Suspense } from "react";
import { CiRunsView } from "./_components/CiRunsView";

export default function CiRunsPage() {
  return (
    <Suspense fallback={null}>
      <CiRunsView />
    </Suspense>
  );
}
