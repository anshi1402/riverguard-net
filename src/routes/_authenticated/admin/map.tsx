import { createFileRoute } from "@tanstack/react-router";
import { ComplaintMap } from "@/components/complaints/ComplaintMap";

export const Route = createFileRoute("/_authenticated/admin/map")({
  component: () => (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">Statewide Map</h1><p className="text-sm text-muted-foreground">All geo-tagged complaints.</p></div>
      <ComplaintMap />
    </div>
  ),
});
