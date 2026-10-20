import React from "react"
import { CheckIcon, InfoIcon } from "./Icons"

interface ToastProps {
  message: string | null
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce duration-300 pointer-events-none max-w-sm w-full px-4">
      <div className="glass-panel px-4 py-3 rounded-2xl shadow-xl border border-[var(--border-color)] flex items-center gap-2.5 text-sm font-semibold text-[var(--text-main)] bg-[var(--surface-primary)]/90">
        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
          <CheckIcon size={14} color="white" />
        </div>
        <span className="truncate">{message}</span>
      </div>
    </div>
  )
}
