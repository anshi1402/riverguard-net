import { createFileRoute } from "@tanstack/react-router";
import { NotificationsList } from "@/components/app/NotificationsList";
export const Route = createFileRoute("/_authenticated/admin/notifications")({ component: NotificationsList });
