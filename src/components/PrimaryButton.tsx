import React from "react"

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "emergency" | "ghost"
  size?: "sm" | "md" | "lg"
  icon?: React.ReactNode
  fullWidth?: boolean
  children: React.ReactNode
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: "h-9 px-3.5 text-xs rounded-xl",
    md: "h-11 px-5 text-sm rounded-xl",
    lg: "h-13 px-6 text-base rounded-2xl",
  }

  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    outline: "btn-outline",
    emergency: "btn-emergency",
    ghost: "bg-transparent text-[var(--color-primary)] hover:bg-[var(--surface-soft-blue)]",
  }

  return (
    <button
      className={`btn-tactile ${sizeClasses[size]} ${variantClasses[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
