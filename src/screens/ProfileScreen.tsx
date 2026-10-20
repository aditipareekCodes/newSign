import React, { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useApp } from "../context/AppContext"
import { Language, StoredUser, VoiceGender, VoiceSelections } from "../types"
import { speechService } from "../services/speechService"
import { PageHeader } from "../components/PageHeader"
import { PrimaryButton } from "../components/PrimaryButton"
import { ThemeSwitcher } from "../components/ThemeSwitcher"
import { Modal } from "../components/Modal"
import {
  UserIcon,
  LogOutIcon,
  CheckIcon,
  EditIcon,
  SpeakerIcon,
  EyeIcon,
  AlertIcon,
} from "../components/Icons"
import { authService } from "../services/authService"

export const ProfileScreen: React.FC = () => {
  const { user, logout, updateProfile, updateSettings } = useAuth()
  const { setScreen, defaultLanguage, setDefaultLanguage, notify } = useApp()

  // Profile Edit modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState(user?.name || "")
  const [editPhone, setEditPhone] = useState(user?.phone || "")
  const [editGender, setEditGender] = useState<"Male" | "Female" | "">(user?.gender || "")

  // Password Change modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Available installed voices
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const loadVoices = () => {
      setVoices(speechService.getVoices())
    }
    loadVoices()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
      return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
    }
  }, [])

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      notify("Name cannot be empty")
      return
    }
    updateProfile({
      name: editName.trim(),
      phone: editPhone.trim(),
      gender: editGender,
    })
    setIsEditProfileOpen(false)
    notify("Profile details updated")
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")

    if (!user) return

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    const res = await authService.changePasswordAsync(user.email, currentPassword, newPassword)
    if (res.success) {
      setIsPasswordModalOpen(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      notify("Password updated successfully")
    } else {
      setPasswordError(res.error || "Failed to update password.")
    }
  }

  const userVoiceGender: VoiceGender = user?.voiceGender === "male" ? "male" : "female"

  // Matching voices for the selected defaultLanguage and userVoiceGender
  const matchingVoices = speechService.getVoicesFor(defaultLanguage, userVoiceGender)
  const currentVoiceId = user?.voiceSelections?.[defaultLanguage]?.[userVoiceGender] || ""

  // Ensure first available compatible voice is automatically selected if none is chosen
  useEffect(() => {
    if (!user) return
    const available = speechService.getVoicesFor(defaultLanguage, userVoiceGender)
    if (available.length > 0) {
      const selectedId = user.voiceSelections?.[defaultLanguage]?.[userVoiceGender]
      const isValid = available.some((v) => speechService.getVoiceIdentifier(v) === selectedId)
      if (!isValid) {
        const firstVoice = available[0]
        const firstId = speechService.getVoiceIdentifier(firstVoice)
        const nextSelections: VoiceSelections = {
          English: { ...(user.voiceSelections?.English || { female: "", male: "" }) },
          Hindi: { ...(user.voiceSelections?.Hindi || { female: "", male: "" }) },
          Marathi: { ...(user.voiceSelections?.Marathi || { female: "", male: "" }) },
        }
        nextSelections[defaultLanguage] = {
          female: userVoiceGender === "female" ? firstId : "",
          male: userVoiceGender === "male" ? firstId : "",
        }
        updateSettings({
          voiceSelections: nextSelections,
          preferredVoices: {
            ...(user.preferredVoices || { English: "", Hindi: "", Marathi: "" }),
            [defaultLanguage]: firstVoice.name,
          },
        })
      }
    }
  }, [voices, defaultLanguage, userVoiceGender, user?.voiceSelections])

  const handleGenderChange = (targetGender: VoiceGender) => {
    const available = speechService.getVoicesFor(defaultLanguage, targetGender)
    const currentSavedKey = user?.voiceSelections?.[defaultLanguage]?.[targetGender] || ""
    const hasValidSelection = available.some((v) => speechService.getVoiceIdentifier(v) === currentSavedKey)

    // Automatically select the first available compatible voice only if the user has not selected one
    const selectedVoice = hasValidSelection
      ? available.find((v) => speechService.getVoiceIdentifier(v) === currentSavedKey)
      : available[0] || null

    const selectedKey = selectedVoice ? speechService.getVoiceIdentifier(selectedVoice) : ""

    // Clear previously selected opposite-gender voice
    const nextSelections: VoiceSelections = {
      English: { ...(user?.voiceSelections?.English || { female: "", male: "" }) },
      Hindi: { ...(user?.voiceSelections?.Hindi || { female: "", male: "" }) },
      Marathi: { ...(user?.voiceSelections?.Marathi || { female: "", male: "" }) },
    }

    nextSelections[defaultLanguage] = {
      female: targetGender === "female" ? selectedKey : "",
      male: targetGender === "male" ? selectedKey : "",
    }

    const nextPreferred = {
      ...(user?.preferredVoices || { English: "", Hindi: "", Marathi: "" }),
      [defaultLanguage]: selectedVoice ? selectedVoice.name : "",
    }

    updateSettings({
      voiceGender: targetGender,
      voiceSelections: nextSelections,
      preferredVoices: nextPreferred,
    })

    if (!selectedVoice) {
      notify(speechService.getUnavailableMessage(targetGender, defaultLanguage))
    } else {
      notify(`Selected ${targetGender} voice: ${selectedVoice.name}`)
    }
  }

  const handleVoiceSelect = (voiceId: string) => {
    const available = speechService.getVoicesFor(defaultLanguage, userVoiceGender)
    const chosenVoice = available.find((v) => speechService.getVoiceIdentifier(v) === voiceId)
    if (!chosenVoice) return

    const nextSelections: VoiceSelections = {
      English: { ...(user?.voiceSelections?.English || { female: "", male: "" }) },
      Hindi: { ...(user?.voiceSelections?.Hindi || { female: "", male: "" }) },
      Marathi: { ...(user?.voiceSelections?.Marathi || { female: "", male: "" }) },
    }

    nextSelections[defaultLanguage] = {
      female: userVoiceGender === "female" ? voiceId : "",
      male: userVoiceGender === "male" ? voiceId : "",
    }

    updateSettings({
      voiceGender: userVoiceGender,
      preferredVoices: {
        ...(user?.preferredVoices || { English: "", Hindi: "", Marathi: "" }),
        [defaultLanguage]: chosenVoice.name,
      },
      voiceSelections: nextSelections,
    })

    notify(`Selected voice: ${chosenVoice.name}`)
  }

  const handleLanguageChange = (newLang: Language) => {
    setDefaultLanguage(newLang)
    const available = speechService.getVoicesFor(newLang, userVoiceGender)
    const currentSavedKey = user?.voiceSelections?.[newLang]?.[userVoiceGender] || ""
    const hasValidSelection = available.some((v) => speechService.getVoiceIdentifier(v) === currentSavedKey)

    const selectedVoice = hasValidSelection
      ? available.find((v) => speechService.getVoiceIdentifier(v) === currentSavedKey)
      : available[0] || null

    const selectedKey = selectedVoice ? speechService.getVoiceIdentifier(selectedVoice) : ""

    const nextSelections: VoiceSelections = {
      English: { ...(user?.voiceSelections?.English || { female: "", male: "" }) },
      Hindi: { ...(user?.voiceSelections?.Hindi || { female: "", male: "" }) },
      Marathi: { ...(user?.voiceSelections?.Marathi || { female: "", male: "" }) },
    }

    nextSelections[newLang] = {
      female: userVoiceGender === "female" ? selectedKey : "",
      male: userVoiceGender === "male" ? selectedKey : "",
    }

    updateSettings({
      preferredLanguage: newLang,
      voiceSelections: nextSelections,
      preferredVoices: {
        ...(user?.preferredVoices || { English: "", Hindi: "", Marathi: "" }),
        [newLang]: selectedVoice ? selectedVoice.name : "",
      },
    })

    if (!selectedVoice) {
      notify(speechService.getUnavailableMessage(userVoiceGender, newLang))
    }
  }

  const handleSavePreference = () => {
    const available = speechService.getVoicesFor(defaultLanguage, userVoiceGender)
    const voiceId = user?.voiceSelections?.[defaultLanguage]?.[userVoiceGender] || ""
    const voice = available.find((v) => speechService.getVoiceIdentifier(v) === voiceId) || available[0]

    if (!voice) {
      notify(`${speechService.getUnavailableMessage(userVoiceGender, defaultLanguage)} ${speechService.getHelpMessage(userVoiceGender, defaultLanguage)}`)
      return
    }

    notify(`Saved voice preference: ${voice.name} for ${defaultLanguage}`)
  }

  const handlePreviewVoice = () => {
    const hasVoice = speechService.hasVoiceFor(defaultLanguage, userVoiceGender)
    if (!hasVoice) {
      notify(`${speechService.getUnavailableMessage(userVoiceGender, defaultLanguage)} ${speechService.getHelpMessage(userVoiceGender, defaultLanguage)}`)
      return
    }

    const sample =
      defaultLanguage === "Hindi"
        ? "नमस्ते, यह आवाज़ का पूर्वावलोकन है।"
        : defaultLanguage === "Marathi"
        ? "नमस्कार, हा आवाजाचा नमुना आहे."
        : "Hello, this is a sample voice preview for SignVaani."

    speechService.speak(
      sample,
      defaultLanguage,
      user?.speechRate || 1.0,
      user?.preferredVoices?.[defaultLanguage] || "",
      userVoiceGender,
      user?.voiceSelections,
      {
        onVoiceWarning: (warn) => notify(warn),
        onError: (err) => notify(err),
      }
    )
  }

  const userInitial = user?.name ? user.name[0].toUpperCase() : "U"

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Profile & Settings"
        subtitle="Manage account details, speech preferences, and appearance"
        onBack={() => setScreen("home")}
      />

      {/* Designed Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--surface-primary)] via-[var(--surface-elevated)] to-[var(--surface-soft-blue)] border border-[var(--border-color)] p-6 sm:p-8 shadow-sm">
        {/* Subtle decorative background wave */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-[var(--color-aqua)]/10 to-[var(--color-primary)]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Circular avatar with initials */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-lavender)] text-white text-3xl font-extrabold flex items-center justify-center shadow-lg ring-4 ring-[var(--surface-primary)]">
              {userInitial}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[var(--text-main)]">
                {user?.name || "Member"}
              </h2>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {user?.email || "user@signvaani.com"}
              </p>
              {user?.gender && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--surface-soft-blue)] text-[var(--color-primary)] mt-1">
                  {user.gender}
                </span>
              )}
            </div>
          </div>

          <PrimaryButton
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(user?.name || "")
              setEditPhone(user?.phone || "")
              setEditGender(user?.gender || "")
              setIsEditProfileOpen(true)
            }}
            icon={<EditIcon size={14} />}
          >
            Edit Profile
          </PrimaryButton>
        </div>
      </div>

      {/* Personal Details (Clean card without username or exposed password) */}
      <div className="p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Full Name
            </span>
            <span className="font-bold text-[var(--text-main)]">{user?.name}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Email Address
            </span>
            <span className="font-bold text-[var(--text-main)]">{user?.email}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Phone Number
            </span>
            <span className="font-bold text-[var(--text-main)]">{user?.phone || "Not set"}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Gender
            </span>
            <span className="font-bold text-[var(--text-main)]">{user?.gender || "Not specified"}</span>
          </div>
        </div>
      </div>

      {/* Speech & Language Preferences */}
      <div className="p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-5">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
          Speech &amp; Recognition Preferences
        </h3>

        <div className="space-y-4">
          {/* Default Output Language */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-sm font-bold text-[var(--text-main)] block">
                Default Output Language
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Updates Home, Recognition, and Sentence Builder immediately
              </span>
            </div>
            <select
              value={defaultLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="input-field sm:w-44 !h-10 text-xs font-bold"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="Marathi">Marathi (मराठी)</option>
            </select>
          </div>

          {/* Speech Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-sm font-bold text-[var(--text-main)] block">
                Speech Mode
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {user?.speechBehaviour === "auto"
                  ? "Speak automatically upon word confirmation"
                  : "Require manual confirmation before speaking"}
              </span>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-color)]">
              <button
                onClick={() => updateSettings({ speechBehaviour: "confirm" })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  user?.speechBehaviour === "confirm"
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                Confirm First
              </button>
              <button
                onClick={() => updateSettings({ speechBehaviour: "auto" })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  user?.speechBehaviour === "auto"
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                Auto Speak
              </button>
            </div>
          </div>

          {/* Speech Speed Slider */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-[var(--text-main)] block">
                  Speech Rate
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Speed of the synthesized voice
                </span>
              </div>
              <span className="font-extrabold text-sm text-[var(--color-primary)]">
                {user?.speechRate ? user.speechRate.toFixed(1) : "1.0"}x
              </span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.1"
              value={user?.speechRate || 1.0}
              onChange={(e) => updateSettings({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-[var(--color-primary)] cursor-pointer"
            />
          </div>

          {/* Voice Gender & Exact Voice Selection Flow */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-[var(--text-main)] block">
                  Voice Gender ({defaultLanguage})
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Filtered strictly for verified {defaultLanguage} voices
                </span>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => handleGenderChange("female")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userVoiceGender === "female"
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                  }`}
                >
                  Female Voice
                </button>
                <button
                  type="button"
                  onClick={() => handleGenderChange("male")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    userVoiceGender === "male"
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                  }`}
                >
                  Male Voice
                </button>
              </div>
            </div>

            {/* Warning or Informational Notice */}
            {matchingVoices.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertIcon size={16} />
                  <span>{speechService.getUnavailableMessage(userVoiceGender, defaultLanguage)}</span>
                </div>
                <p className="text-[11px] opacity-90 pl-5">
                  {speechService.getHelpMessage(userVoiceGender, defaultLanguage)}
                </p>
              </div>
            ) : defaultLanguage === "Marathi" && !speechService.hasNativeVoiceFor("Marathi") ? (
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-xs space-y-1">
                <span className="font-bold block">
                  Using compatible Devanagari {userVoiceGender} voice for Marathi
                </span>
                <p className="text-[11px] opacity-90">
                  Windows does not install a Marathi TTS voice by default. SignVaani is using a verified {userVoiceGender} Devanagari voice so speech functions seamlessly. To get native Marathi voices (Microsoft Aarohi &amp; Manohar), install Marathi in Windows Settings → Time &amp; Language → Language.
                </p>
              </div>
            ) : null}

            {/* Exact Voice Selection */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Matching {defaultLanguage} ({userVoiceGender}) Voice
                </label>
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {matchingVoices.length} available
                </span>
              </div>

              <select
                disabled={matchingVoices.length === 0}
                value={currentVoiceId || (matchingVoices[0] ? speechService.getVoiceIdentifier(matchingVoices[0]) : "")}
                onChange={(e) => handleVoiceSelect(e.target.value)}
                className="input-field !h-11 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {matchingVoices.length === 0 ? (
                  <option value="">No {userVoiceGender} voice installed</option>
                ) : (
                  matchingVoices.map((v) => {
                    const id = speechService.getVoiceIdentifier(v)
                    const isFallback = speechService.isUsingDevanagariFallback(defaultLanguage, v)
                    return (
                      <option key={id} value={id}>
                        {v.name} {isFallback ? "(Devanagari Compatible)" : `(${v.lang})`}
                      </option>
                    )
                  })
                )}
              </select>
            </div>

            {/* Action Buttons: Preview & Save Preference */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={matchingVoices.length === 0}
                onClick={handlePreviewVoice}
                className="btn-tactile px-3.5 py-2 rounded-xl bg-[var(--surface-soft-blue)] text-[var(--color-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[var(--color-primary)] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SpeakerIcon size={14} />
                <span>Preview Voice</span>
              </button>

              <button
                type="button"
                disabled={matchingVoices.length === 0}
                onClick={handleSavePreference}
                className="btn-tactile px-3.5 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon size={14} />
                <span>Save Preference</span>
              </button>
            </div>
          </div>

          {/* Show Confidence Score Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-sm font-bold text-[var(--text-main)] block">
                Show Confidence Score
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Display numerical match ring during recognition
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ showConfidence: !user?.showConfidence })}
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                user?.showConfidence ? "bg-[var(--color-primary)]" : "bg-[var(--border-color)]"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  user?.showConfidence ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Appearance: Visual Theme Preview Cards */}
      <div className="p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
          Appearance
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Choose an interface style or match your system preferences.
        </p>
        <ThemeSwitcher variant="cards" />
      </div>

      {/* Account Security & Actions */}
      <div className="p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
          Account Security &amp; Tools
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <PrimaryButton
            variant="outline"
            size="md"
            onClick={() => {
              setPasswordError("")
              setCurrentPassword("")
              setNewPassword("")
              setConfirmPassword("")
              setIsPasswordModalOpen(true)
            }}
          >
            Change Password
          </PrimaryButton>

          <PrimaryButton
            variant="outline"
            size="md"
            onClick={() => setScreen("data-collection")}
          >
            Data Collection Tool
          </PrimaryButton>

          <PrimaryButton
            variant="outline"
            size="md"
            onClick={() => {
              logout()
              setScreen("login")
            }}
            icon={<LogOutIcon size={16} />}
            className="!text-[var(--color-emergency)] !border-[var(--color-emergency-border)] hover:!bg-[var(--color-emergency-surface)]"
          >
            Sign Out
          </PrimaryButton>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        title="Edit Personal Information"
        subtitle="Update your full name, phone number, and gender"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <PrimaryButton
              variant="outline"
              size="md"
              onClick={() => setIsEditProfileOpen(false)}
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton
              variant="primary"
              size="md"
              onClick={handleSaveProfile}
            >
              Save Changes
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your full name"
              className="input-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Phone Number
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="input-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Gender (Strictly Male or Female)
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {(["Male", "Female"] as const).map((genderOption) => (
                <button
                  key={genderOption}
                  type="button"
                  onClick={() => setEditGender(genderOption)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    editGender === genderOption
                      ? "border-[var(--color-primary)] bg-[var(--surface-soft-blue)] text-[var(--color-primary)]"
                      : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {genderOption}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Account Password"
        subtitle="Ensure your account is protected with a secure password"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <PrimaryButton
              variant="outline"
              size="md"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton
              variant="primary"
              size="md"
              onClick={handleChangePassword}
            >
              Update Password
            </PrimaryButton>
          </div>
        }
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 rounded-xl bg-[var(--color-emergency-surface)] text-[var(--color-emergency)] text-xs font-semibold">
              {passwordError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="input-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input-field pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
              >
                <EyeIcon size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              className="input-field"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
