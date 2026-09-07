import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { ResolvedTheme, Theme } from "./enums/Theme.enum";

/**
 * index.html의 인라인 스크립트도 동일한 키를 읽는다.
 * (화면이 그려지기 전에 <html data-theme>을 미리 세팅해 깜빡임을 막기 위함)
 */
export const THEME_STORAGE_KEY = "theme";

interface ThemeContextType {
  /** 사용자가 고른 값 (system 포함) */
  theme: Theme;
  /** 실제 적용 중인 값 (light | dark 로 확정) */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_QUERY = "(prefers-color-scheme: dark)";

const readStoredTheme = (): Theme => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === Theme.LIGHT || saved === Theme.DARK || saved === Theme.SYSTEM) return saved;
  return Theme.SYSTEM;
};

const resolve = (theme: Theme): ResolvedTheme => {
  if (theme === Theme.SYSTEM) {
    return window.matchMedia(DARK_QUERY).matches ? ResolvedTheme.DARK : ResolvedTheme.LIGHT;
  }
  return theme === Theme.DARK ? ResolvedTheme.DARK : ResolvedTheme.LIGHT;
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readStoredTheme()));

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  // 선택값이 바뀌면 <html data-theme>과 color-scheme을 갱신
  useEffect(() => {
    const applied = resolve(theme);
    setResolvedTheme(applied);
    document.documentElement.dataset.theme = applied;
    // 네이티브 스크롤바 / 폼 컨트롤도 테마를 따라가도록
    document.documentElement.style.colorScheme = applied;
  }, [theme]);

  // SYSTEM인 동안에는 OS 설정 변경을 실시간으로 따라간다
  useEffect(() => {
    if (theme !== Theme.SYSTEM) return;

    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => {
      const applied = media.matches ? ResolvedTheme.DARK : ResolvedTheme.LIGHT;
      setResolvedTheme(applied);
      document.documentElement.dataset.theme = applied;
      document.documentElement.style.colorScheme = applied;
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const value: ThemeContextType = { theme, resolvedTheme, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme이 ThemeProvider 외부에서 호출되었습니다.');
  }
  return context;
};
