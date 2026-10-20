import React from "react"
import { ChevronLeftIcon } from "./Icons"

interface PageHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  action,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 py-4 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--surface-primary)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer shrink-0 shadow-sm"
            aria-label="Go back"
          >
            <ChevronLeftIcon size={20} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-main)] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
