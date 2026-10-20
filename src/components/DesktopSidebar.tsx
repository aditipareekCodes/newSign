import React from "react"
import { Screen } from "../types"
import { HomeIcon, CameraIcon, BookmarkIcon, UserIcon, HandIcon, LogOutIcon } from "./Icons"
import { useAuth } from "../context/AuthContext"

interface DesktopSidebarProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentScreen, onNavigate }) => {
  const { user, logout } = useAuth()

  const navItems: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <HomeIcon size={20} /> },
    { id: "recognize", label: "Recognize", icon: <CameraIcon size={20} /> },
    { id: "phrases", label: "Saved Phrases", icon: <BookmarkIcon size={20} /> },
    { id: "profile", label: "Profile", icon: <UserIcon size={20} /> },
  ]

  const userInitial = user?.name ? user.name[0].toUpperCase() : "U"

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation()
    logout()
    onNavigate("login")
  }

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 h-screen sticky top-0 border-r border-[var(--border-color)] bg-[var(--surface-primary)] p-5 z-30 select-none">
      <div className="space-y-6">
        {/* Brand identity */}
        <div
          onClick={() => onNavigate("home")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-aqua)] flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
            <HandIcon size={22} color="white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight tracking-tight text-[var(--text-main)]">
              SignVaani
            </div>
            <div className="text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)]">
              Gesture Flow AI
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5 pt-2">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all text-left cursor-pointer relative ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-deep)] text-white shadow-md shadow-[var(--color-primary-glow)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
                }`}
              >
                <span className={isActive ? "text-white" : "text-[var(--text-secondary)]"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-4 bg-white/70 rounded-full" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer controls: Only User Card and Logout */}
      <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
        {/* User Card */}
        {user && (
          <div
            onClick={() => onNavigate("profile")}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--color-primary)] transition-all group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-lavender)] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[var(--text-main)] truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                {user.email}
              </div>
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-emergency)] hover:bg-[var(--color-emergency-surface)] transition-all cursor-pointer"
        >
          <LogOutIcon size={16} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
