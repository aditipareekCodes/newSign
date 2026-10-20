import React from "react"
import { HistoryItem } from "../types"
import { SpeechButton } from "./SpeechButton"
import { TrashIcon } from "./Icons"
import { StatusBadge } from "./StatusBadge"
import { useApp } from "../context/AppContext"

interface CommunicationItemProps {
  item: HistoryItem
  showDelete?: boolean
}

export const CommunicationItem: React.FC<CommunicationItemProps> = ({
  item,
  showDelete = true,
}) => {
  const { deleteHistoryItem, notify } = useApp()

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso)
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    } catch {
      return ""
    }
  }

  const sourceLabels = {
    recognition: { label: "Recognition", status: "info" as const },
    saved_phrase: { label: "Saved Phrase", status: "neutral" as const },
    emergency_phrase: { label: "Emergency", status: "emergency" as const },
  }

  const meta = sourceLabels[item.source] || { label: "General", status: "neutral" as const }

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 md:p-4 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-color)] hover:border-[var(--color-primary)]/40 transition-all shadow-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm md:text-base font-bold text-[var(--text-main)] truncate">
          {item.translation || item.text}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <StatusBadge status={meta.status} label={meta.label} />
          <span>·</span>
          <span className="font-semibold text-[var(--text-main)]">{item.language}</span>
          <span>·</span>
          <span>{formatTime(item.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <SpeechButton
          text={item.translation || item.text}
          language={item.language}
          onWarning={(msg) => notify(msg)}
          size="sm"
        />
        {showDelete && (
          <button
            onClick={() => deleteHistoryItem(item.id)}
            title="Delete record"
            aria-label="Delete record"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--color-emergency)] hover:bg-[var(--color-emergency-surface)] transition-colors cursor-pointer"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
