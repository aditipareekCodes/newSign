import React from "react"
import { useAuth } from "../context/AuthContext"
import { useApp } from "../context/AppContext"
import {
  CameraIcon,
  BookmarkIcon,
  AlertIcon,
  HandIcon,
} from "../components/Icons"
import { CommunicationItem } from "../components/CommunicationItem"
import { EmptyState } from "../components/EmptyState"

export const HomeScreen: React.FC = () => {
  const { user } = useAuth()
  const { setScreen, history, defaultLanguage, setEmergencyModalOpen } =
    useApp()

  const userName = user?.name || "User"
  const userInitial = userName[0]?.toUpperCase() || "U"
  const recentItems = history.slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border-subtle)] pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--text-main)] tracking-tight truncate">
            Welcome, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            Output language ·{" "}
            <span className="font-bold text-[var(--color-primary)]">
              {defaultLanguage}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setScreen("profile")}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-lavender)] text-white font-extrabold text-sm flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 transition-transform"
            title="View Profile"
            aria-label="View Profile"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* Recognition Hero: Gesture Flow */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-deep)] to-[#151E3D] text-white shadow-xl shadow-indigo-950/10">
        {/* Abstract motion trails & ambient lighting */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-[var(--color-aqua)]/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-16 w-64 h-64 rounded-full bg-[var(--color-lavender)]/25 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[var(--color-aqua)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-aqua)] animate-pulse" />
              <span>Camera Vision Ready</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Start Sign Recognition
            </h2>

            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              Capture your Indian Sign Language gestures in real-time. Convert
              them into interactive text, translate to Hindi or Marathi, and
              speak aloud.
            </p>

            <div className="pt-2">
              <button
                onClick={() => setScreen("recognize")}
                className="btn-tactile px-6 py-3.5 rounded-2xl bg-white text-[var(--color-primary-deep)] font-extrabold text-sm shadow-lg hover:bg-white/95 hover:shadow-xl transition-all cursor-pointer inline-flex items-center gap-2.5"
              >
                <CameraIcon size={19} color="currentColor" />
                <span>Start Signing</span>
              </button>
            </div>
          </div>

          {/* Abstract Hand Outline & Soundwave Trail */}
          <div className="relative shrink-0 w-36 h-36 sm:w-44 sm:h-44 mx-auto md:mx-0 flex items-center justify-center">
            {/* Concentric ripples */}
            <div className="absolute inset-0 rounded-full border border-white/15 animate-ping opacity-30 pointer-events-none" />
            <div className="absolute inset-4 rounded-full border border-white/25 animate-pulse pointer-events-none" />

            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl rotate-3 hover:rotate-0 transition-transform">
              <HandIcon size={44} color="white" />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions (ONLY TWO: Saved Phrases & Emergency Phrases) */}
      <section className="space-y-3">
        <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-main)] tracking-tight">
          Quick Actions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Action 1: Saved Phrases (Lavender/Blue surface) */}
          <button
            onClick={() => setScreen("phrases")}
            className="p-5 rounded-2xl bg-gradient-to-br from-[var(--surface-primary)] to-[var(--surface-soft-blue)] border border-[var(--border-color)] hover:border-[var(--color-primary)] text-left shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <BookmarkIcon size={22} color="white" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[var(--text-main)]">
                Saved Phrases
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Browse pre-built and custom phrases with instant translations
              </p>
            </div>
          </button>

          {/* Action 2: Emergency Phrases (Pale red surface, red border, emergency icon, dark red text) */}
          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="p-5 rounded-2xl bg-[var(--color-emergency-surface)] border-2 border-[var(--color-emergency-border)] hover:border-[var(--color-emergency)] text-left shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-emergency)] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <AlertIcon size={24} color="white" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-[var(--color-emergency)]">
                Emergency Phrases
              </h4>
              <p className="text-xs text-[var(--color-emergency)]/80 mt-0.5">
                Instant one-tap spoken phrases for high-priority urgent needs
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-[var(--text-main)]">
              ISL Dataset Collection
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Collect explicitly labelled landmark performances locally for
              research.
            </p>
          </div>
          <button
            onClick={() => setScreen("data-collection")}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            Open collection tool
          </button>
        </div>
      </section>

      {/* Recent Communication */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-main)] tracking-tight">
            Recent Communication
          </h3>
          <button
            onClick={() => setScreen("history")}
            className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            View History
          </button>
        </div>

        {recentItems.length > 0 ? (
          <div className="space-y-2.5">
            {recentItems.map((item) => (
              <CommunicationItem key={item.id} item={item} showDelete={false} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No communication history yet."
            description="Phrases and recognized sentences will appear here after you speak them."
            actionLabel="Start Recognition"
            onAction={() => setScreen("recognize")}
            icon={<HandIcon size={28} />}
          />
        )}
      </section>
    </div>
  )
}
