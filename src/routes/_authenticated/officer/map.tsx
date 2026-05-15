import { createFileRoute } from "@tanstack/react-router";
import { ComplaintMap } from "@/components/complaints/ComplaintMap";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/officer/map")({ component: Page });

function Page() {
  const { profile } = useAuth();
  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">District Map</h1><p className="text-sm text-muted-foreground">Geo-tagged complaints in your district.</p></div>
      {profile?.district_id && <ComplaintMap districtId={profile.district_id} />}
    </div>
  );
}
