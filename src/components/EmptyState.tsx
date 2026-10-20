import React from "react"
import { HandIcon } from "./Icons"
import { PrimaryButton } from "./PrimaryButton"

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] my-6 max-w-md mx-auto space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--surface-soft-blue)] to-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--color-primary)] shadow-sm">
        {icon || <HandIcon size={32} />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[var(--text-main)]">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <PrimaryButton variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </PrimaryButton>
      )}
    </div>
  )
}
