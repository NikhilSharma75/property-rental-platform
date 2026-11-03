import { Droplet, Zap, Thermometer, Refrigerator, Building2, Bug, HelpCircle, LucideIcon } from "lucide-react";
import { MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from "@/lib/api";

export const CATEGORY_CONFIG: Record<MaintenanceCategory, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  PLUMBING:      { label: "Plumbing",      icon: Droplet,      color: "#2455eb", bg: "#2455eb22" },
  ELECTRICAL:    { label: "Electrical",    icon: Zap,          color: "#c9972b", bg: "#c9972b22" },
  HVAC:          { label: "HVAC",          icon: Thermometer,  color: "#0ea5a5", bg: "#0ea5a522" },
  APPLIANCE:     { label: "Appliance",     icon: Refrigerator, color: "#7c3aed", bg: "#7c3aed22" },
  STRUCTURAL:    { label: "Structural",    icon: Building2,    color: "var(--color-ink)", bg: "color-mix(in srgb, var(--color-ink) 10%, transparent)" },
  PEST_CONTROL:  { label: "Pest Control",  icon: Bug,          color: "#16a34a", bg: "#16a34a22" },
  OTHER:         { label: "Other",         icon: HelpCircle,   color: "#64748b", bg: "#64748b22" },
};

export const PRIORITY_CONFIG: Record<MaintenancePriority, { label: string; color: string; bg: string; pulse?: boolean }> = {
  LOW:      { label: "Low",      color: "#64748b", bg: "#64748b22" },
  MEDIUM:   { label: "Medium",   color: "#c9972b", bg: "#c9972b22" },
  HIGH:     { label: "High",     color: "#ea580c", bg: "#ea580c22" },
  EMERGENCY:{ label: "Emergency",color: "#dc2626", bg: "#dc262622", pulse: true },
};

export const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
  SUBMITTED:    { label: "Submitted",    color: "#64748b", bg: "#64748b22" },
  ACKNOWLEDGED: { label: "Acknowledged", color: "#2455eb", bg: "#2455eb22" },
  IN_PROGRESS:  { label: "In Progress",  color: "#c9972b", bg: "#c9972b22" },
  COMPLETED:    { label: "Completed",    color: "#16a34a", bg: "#16a34a22" },
  CANCELLED:    { label: "Cancelled",    color: "#94a3b8", bg: "#94a3b822" },
};

export const STATUS_ORDER: MaintenanceStatus[] = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"];