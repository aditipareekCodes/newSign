import React from "react"
import { DesktopSidebar } from "./DesktopSidebar"
import { MobileNavigation } from "./MobileNavigation"
import { Toast } from "./Toast"
import { useApp } from "../context/AppContext"
import { EmergencyModal } from "../screens/EmergencyModal"

interface AppShellProps {
  children: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { screen, setScreen, toast, emergencyModalOpen, setEmergencyModalOpen } = useApp()

  const isAuthScreen = ["login", "register", "otp", "forgot-password"].includes(screen)

  return (
    <div className="min-h-[100dvh] w-full bg-[var(--bg-main)] flex text-[var(--text-main)] transition-colors duration-200">
      {/* Toast Notification */}
      <Toast message={toast} />

      {/* Desktop Sidebar (Only for authenticated screens) */}
      {!isAuthScreen && (
        <DesktopSidebar currentScreen={screen} onNavigate={setScreen} />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-y-auto">
        <div
          className={`flex-1 w-full mx-auto ${
            isAuthScreen
              ? "max-w-full"
              : "max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8"
          }`}
        >
          {children}
        </div>
      </main>

      {/* Mobile Glass Navigation */}
      {!isAuthScreen && (
        <MobileNavigation currentScreen={screen} onNavigate={setScreen} />
      )}

      {/* Global Emergency Modal */}
      <EmergencyModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
      />
    </div>
  )
}
