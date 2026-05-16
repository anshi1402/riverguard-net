import { createFileRoute } from "@tanstack/react-router";
import { AlertsView } from "@/routes/_authenticated/officer/ai-alerts";

export const Route = createFileRoute("/_authenticated/admin/ai-alerts")({
  component: () => <AlertsView title="AI Alerts — State Overview" />,
});
