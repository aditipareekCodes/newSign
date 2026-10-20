import React from "react"

interface StatusBadgeProps {
  status: "success" | "warning" | "emergency" | "info" | "neutral"
  label: string
  icon?: React.ReactNode
  pulse?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  icon,
  pulse = false,
}) => {
  const styles = {
    success: "bg-[var(--color-success-surface)] text-[var(--color-success)] border-[var(--color-success)]/20",
    warning: "bg-[var(--color-warning-surface)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
    emergency: "bg-[var(--color-emergency-surface)] text-[var(--color-emergency)] border-[var(--color-emergency-border)]",
    info: "bg-[var(--surface-soft-blue)] text-[var(--color-primary)] border-[var(--color-primary)]/20",
    neutral: "bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border-color)]",
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${styles[status]}`}
    >
      {pulse && (
        <span
          className={`w-2 h-2 rounded-full animate-ping ${
            status === "success"
              ? "bg-[var(--color-success)]"
              : status === "emergency"
              ? "bg-[var(--color-emergency)]"
              : status === "warning"
              ? "bg-[var(--color-warning)]"
              : "bg-[var(--color-primary)]"
          }`}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  )
}
