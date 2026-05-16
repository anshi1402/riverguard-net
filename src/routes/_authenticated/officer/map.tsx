import { createFileRoute } from "@tanstack/react-router";
import { DistrictMap } from "@/components/maps/DistrictMap";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/officer/map")({ component: Page });

function Page() {
  const { profile } = useAuth();
  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">District Map</h1><p className="text-sm text-muted-foreground">Water bodies, complaints and AI alerts in your district.</p></div>
      {profile?.district_id && <DistrictMap districtId={profile.district_id} />}
    </div>
  );
}
