/** Light haptic feedback on supported devices (Android Chrome etc.). */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // unsupported — ignore
    }
  }
}
