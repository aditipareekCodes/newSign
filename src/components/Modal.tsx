import React, { useEffect } from "react"
import { XIcon } from "./Icons"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl"
  footer?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "md",
  footer,
}) => {
  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    // Lock body scroll
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: "md:max-w-sm",
    md: "md:max-w-lg",
    lg: "md:max-w-2xl",
    xl: "md:max-w-4xl",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClasses[maxWidth]} bg-[var(--surface-primary)] border border-[var(--border-color)] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[88dvh] md:max-h-[85vh] overflow-hidden animate-slideUp md:animate-scaleUp transition-transform`}
      >
        {/* Mobile handle indicator */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border-color)]" />
        </div>

        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur-md">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg md:text-xl font-bold text-[var(--text-main)] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer shrink-0"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>

        {/* Sticky/Bottom Footer */}
        {footer && (
          <div className="sticky bottom-0 z-10 px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur-md pb-[max(14px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
