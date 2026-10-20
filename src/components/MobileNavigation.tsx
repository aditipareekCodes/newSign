import React from "react"
import { Screen } from "../types"
import { HomeIcon, CameraIcon, BookmarkIcon, UserIcon } from "./Icons"

interface MobileNavigationProps {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentScreen,
  onNavigate,
}) => {
  const navItems: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <HomeIcon size={22} /> },
    { id: "recognize", label: "Recognize", icon: <CameraIcon size={22} /> },
    { id: "phrases", label: "Phrases", icon: <BookmarkIcon size={22} /> },
    { id: "profile", label: "Profile", icon: <UserIcon size={22} /> },
  ]

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-[var(--border-color)] px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? "text-[var(--color-primary)] font-bold scale-105"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              }`}
            >
              <div className="relative">
                {item.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shadow-sm shadow-[var(--color-primary-glow)]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
