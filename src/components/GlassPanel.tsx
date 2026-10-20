import React from "react"

interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-2xl ${className}`}
    >
      {children}
    </div>
  )
}
