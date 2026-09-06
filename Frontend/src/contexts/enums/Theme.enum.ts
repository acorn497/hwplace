/**
 * 사용자가 설정에서 선택하는 테마 값.
 * SYSTEM은 OS의 prefers-color-scheme를 따라간다.
 */
export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
}

/**
 * 실제로 화면에 적용되는 테마.
 * Theme.SYSTEM이 선택된 경우 OS 설정에 따라 둘 중 하나로 확정된다.
 */
export enum ResolvedTheme {
  LIGHT = "light",
  DARK = "dark",
}
