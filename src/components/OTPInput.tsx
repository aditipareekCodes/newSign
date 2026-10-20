import React, { useRef, useEffect } from "react"

interface OTPInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  error?: boolean
}

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  disabled = false,
  error = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Auto focus first empty box or box 0
    const firstEmpty = Math.min(value.length, 5)
    inputRefs.current[firstEmpty]?.focus()
  }, [])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1) // take last typed character
    if (char && !/^\d$/.test(char)) return // allow only digits

    const chars = value.split("")
    chars[index] = char || ""
    const nextVal = chars.join("").slice(0, 6)
    onChange(nextVal)

    // Advance focus if digit was entered
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        // Move back and clear previous
        const chars = value.split("")
        chars[index - 1] = ""
        onChange(chars.join(""))
        inputRefs.current[index - 1]?.focus()
      } else {
        // Clear current
        const chars = value.split("")
        chars[index] = ""
        onChange(chars.join(""))
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted) {
      onChange(pasted)
      const targetIndex = Math.min(pasted.length, 5)
      inputRefs.current[targetIndex]?.focus()
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 max-w-sm mx-auto">
      {Array.from({ length: 6 }).map((_, index) => {
        const digit = value[index] || ""
        const isCurrent = value.length === index

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all outline-none ${
              error
                ? "border-[var(--color-emergency)] bg-[var(--color-emergency-surface)] text-[var(--color-emergency)]"
                : digit
                ? "border-[var(--color-primary)] bg-[var(--surface-primary)] text-[var(--color-primary)]"
                : isCurrent
                ? "border-[var(--color-primary)] ring-4 ring-[var(--color-primary-glow)] bg-[var(--surface-primary)] text-[var(--text-main)]"
                : "border-[var(--border-color)] bg-[var(--surface-elevated)] text-[var(--text-main)]"
            }`}
          />
        )
      })}
    </div>
  )
}
