import { MaintenanceStatus } from "@/lib/api";
import { STATUS_CONFIG } from "./maintenanceConfig";

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}