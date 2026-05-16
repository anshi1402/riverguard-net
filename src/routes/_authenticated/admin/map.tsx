import { createFileRoute } from "@tanstack/react-router";
import { DistrictMap } from "@/components/maps/DistrictMap";

export const Route = createFileRoute("/_authenticated/admin/map")({
  component: () => (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">Statewide Map</h1><p className="text-sm text-muted-foreground">Water bodies, complaints and AI alerts by district.</p></div>
      <DistrictMap allowDistrictSwitch />
    </div>
  ),
});
