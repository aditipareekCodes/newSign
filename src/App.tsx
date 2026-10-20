import React, { Suspense, lazy, useState, useEffect } from "react"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider } from "./context/AuthContext"
import { AppProvider, useApp } from "./context/AppContext"
import { AppShell } from "./components/AppShell"
import { HandIcon } from "./components/Icons"

// Screen components
import { LoginScreen } from "./screens/LoginScreen"
import { RegisterScreen } from "./screens/RegisterScreen"
import { OTPScreen } from "./screens/OTPScreen"
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen"
import { HomeScreen } from "./screens/HomeScreen"
import { LiveRecognitionScreen } from "./screens/LiveRecognitionScreen"
import { SentenceBuilderScreen } from "./screens/SentenceBuilderScreen"
import { PhraseLibraryScreen } from "./screens/PhraseLibraryScreen"
import { HistoryScreen } from "./screens/HistoryScreen"
import { ProfileScreen } from "./screens/ProfileScreen"
const ISLDataCollectionScreen = lazy(() =>
  import("./screens/ISLDataCollectionScreen").then((module) => ({
    default: module.ISLDataCollectionScreen,
  })),
)

const AppNavigator: React.FC = () => {
  const { screen } = useApp()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 650)
    return () => clearTimeout(timer)
  }, [])

  if (showSplash) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[var(--bg-main)] p-6 text-center select-none animate-fadeIn">
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-aqua)] flex items-center justify-center shadow-xl shadow-[var(--color-primary-glow)] animate-float">
          <HandIcon size={40} color="white" />
          <div className="absolute -inset-2 rounded-3xl border border-[var(--color-primary)]/30 animate-pulse pointer-events-none" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] mt-6">
          SignVaani
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] mt-1 tracking-wide">
          Gesture Flow Assistive Communication
        </p>

        <div className="flex items-center gap-1.5 mt-8">
          <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" />
          <span
            className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce"
            style={{ animationDelay: "0.3s" }}
          />
        </div>
      </div>
    )
  }

  const renderActiveScreen = () => {
    switch (screen) {
      case "login":
        return <LoginScreen />
      case "register":
        return <RegisterScreen />
      case "otp":
        return <OTPScreen />
      case "forgot-password":
        return <ForgotPasswordScreen />
      case "home":
        return <HomeScreen />
      case "recognize":
        return <LiveRecognitionScreen />
      case "sentence":
        return <SentenceBuilderScreen />
      case "phrases":
        return <PhraseLibraryScreen />
      case "history":
        return <HistoryScreen />
      case "profile":
        return <ProfileScreen />
      case "data-collection":
        return <ISLDataCollectionScreen />
      default:
        return <HomeScreen />
    }
  }

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-[var(--text-secondary)]">
            Loading collection tool…
          </div>
        }
      >
        {renderActiveScreen()}
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
