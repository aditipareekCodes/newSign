/**
 * Camera Utility & Diagnostic Helper
 * Provides resilient getUserMedia resolution across modern and legacy browser contexts (Edge, Chrome, Firefox),
 * secure context verification (localhost vs IP addresses), and actionable diagnostic guidance.
 */

export function isLocalhostOrigin(): boolean {
  if (typeof window === "undefined") return true
  const hostname = window.location.hostname
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  )
}

export function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return true
  if (window.isSecureContext) return true
  return isLocalhostOrigin()
}

export function getLocalhostUrl(): string {
  if (typeof window === "undefined") return "http://localhost:5173"
  const port = window.location.port ? `:${window.location.port}` : ""
  return `http://localhost${port}${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function getCameraDiagnosticMessage(): string | null {
  if (typeof window === "undefined") return null

  // 1. Detect network IP access without HTTPS
  if (!isSecureCameraContext()) {
    return `Microsoft Edge restricts camera access to secure origins. You are accessing SignVaani via "${window.location.hostname}". Please switch to localhost (${getLocalhostUrl()}) or use HTTPS.`
  }

  // 2. Check if mediaDevices or legacy getUserMedia exists
  const hasModern = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
  const legacyNav = navigator as any
  const hasLegacy =
    typeof navigator !== "undefined" &&
    Boolean(
      legacyNav.getUserMedia ||
      legacyNav.webkitGetUserMedia ||
      legacyNav.mozGetUserMedia ||
      legacyNav.msGetUserMedia
    )

  if (!hasModern && !hasLegacy) {
    return (
      "Camera API is not accessible in this browser context. " +
      "If you are using Microsoft Edge, verify that camera access is enabled in " +
      "Windows Settings > Privacy & security > Camera ('Let Microsoft Edge access your camera') and Edge Settings > Cookies & site permissions > Camera."
    )
  }

  return null
}

export async function requestCameraStream(
  constraints: MediaStreamConstraints = {
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  }
): Promise<MediaStream> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("Camera cannot be initialized in a non-browser environment.")
  }

  // 1. Insecure context check (e.g. 192.168.x.x in Edge/Chrome)
  if (!isSecureCameraContext()) {
    const localhostUrl = getLocalhostUrl()
    throw new Error(
      `Microsoft Edge blocks camera access on network IP addresses (${window.location.hostname}). Please open ${localhostUrl} in Microsoft Edge.`
    )
  }

  // 2. Modern navigator.mediaDevices.getUserMedia
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    return await navigator.mediaDevices.getUserMedia(constraints)
  }

  // 3. Fallback to navigator.getUserMedia variants
  const legacyNav = navigator as any
  const legacyGetUserMedia =
    legacyNav.getUserMedia ||
    legacyNav.webkitGetUserMedia ||
    legacyNav.mozGetUserMedia ||
    legacyNav.msGetUserMedia

  if (legacyGetUserMedia) {
    return new Promise<MediaStream>((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject)
    })
  }

  // 4. In case navigator.mediaDevices exists but getUserMedia was shadowed or polyfillable
  if (navigator.mediaDevices) {
    const navAny = navigator as any
    if (navAny.webkitGetUserMedia) {
      return new Promise<MediaStream>((resolve, reject) => {
        navAny.webkitGetUserMedia(constraints, resolve, reject)
      })
    }
  }

  const diag = getCameraDiagnosticMessage()
  throw new Error(
    diag || "Camera API is not supported in this browser. Please use Microsoft Edge or Chrome on http://localhost:5173."
  )
}
