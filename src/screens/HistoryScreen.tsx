import React, { useState } from "react"
import { useApp } from "../context/AppContext"
import { PageHeader } from "../components/PageHeader"
import { CommunicationItem } from "../components/CommunicationItem"
import { EmptyState } from "../components/EmptyState"
import { PrimaryButton } from "../components/PrimaryButton"
import { TrashIcon, ClockIcon, SearchIcon } from "../components/Icons"
import { CommunicationSource } from "../types"

export const HistoryScreen: React.FC = () => {
  const { history, clearHistory, setScreen } = useApp()
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<"all" | CommunicationSource>("all")

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.text.toLowerCase().includes(search.toLowerCase()) ||
      item.translation.toLowerCase().includes(search.toLowerCase()) ||
      item.language.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (sourceFilter === "all") return true
    return item.source === sourceFilter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Communication History"
        subtitle="Complete log of spoken gestures, saved phrases, and emergency calls"
        action={
          history.length > 0 ? (
            <PrimaryButton
              variant="outline"
              size="sm"
              onClick={clearHistory}
              icon={<TrashIcon size={14} />}
              className="!text-[var(--color-emergency)] !border-[var(--color-emergency-border)] hover:!bg-[var(--color-emergency-surface)]"
            >
              Clear Log
            </PrimaryButton>
          ) : undefined
        }
      />

      {/* Filter and Search */}
      {history.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <SearchIcon
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history records..."
              className="input-field pl-10"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-color)]">
            {(
              [
                { id: "all", label: "All" },
                { id: "recognition", label: "Recognition" },
                { id: "saved_phrase", label: "Phrases" },
                { id: "emergency_phrase", label: "Emergency" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSourceFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  sourceFilter === filter.id
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Items */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <CommunicationItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No communication history yet."
          description={
            search
              ? `No records found matching "${search}".`
              : "Spoken translations from recognition, phrase library, and emergency phrases will appear here."
          }
          actionLabel="Start Recognition"
          onAction={() => setScreen("recognize")}
          icon={<ClockIcon size={28} />}
        />
      )}
    </div>
  )
}
