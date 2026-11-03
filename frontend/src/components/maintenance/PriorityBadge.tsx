import { MaintenancePriority } from "@/lib/api";
import { PRIORITY_CONFIG } from "./maintenanceConfig";

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: cfg.color }} />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      </span>
      {cfg.label}
    </span>
  );
}