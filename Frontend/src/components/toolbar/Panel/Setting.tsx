import { useEffect, useState, type ReactNode } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { PanelPosition } from "../../../contexts/enums/PanelPosition.enum";
import { useGlobalVariable } from "../../../contexts/GlobalVariable.context"
import { useTheme } from "../../../contexts/Theme.context";
import { Theme, ResolvedTheme } from "../../../contexts/enums/Theme.enum";
import { PanelShell, PanelSection, SettingRow, Toggle, SegmentedControl } from "../../common/PanelKit";
import { REMEMBER_LOGIN_EMAIL_STORAGE_KEY, SAVED_LOGIN_EMAIL_STORAGE_KEY } from "./Profile/LoginForm";

// App.tsx에서도 최초 마운트 시 이 값을 읽어 <html>에 반영하므로 export 해서 공유한다.
export const REDUCE_MOTION_STORAGE_KEY = "reduceMotion";

// 패널 위치 선택 다이어그램에 쓰이는 프리셋
const POSITION_OPTIONS: { position: PanelPosition, className: string, label: string }[] = [
  { position: PanelPosition.TL, className: "top-2 left-2", label: "왼쪽 위" },
  { position: PanelPosition.TR, className: "top-2 right-2", label: "오른쪽 위" },
  { position: PanelPosition.BL, className: "bottom-2 left-2", label: "왼쪽 아래" },
  { position: PanelPosition.BR, className: "bottom-2 right-2", label: "오른쪽 아래" },
  { position: PanelPosition.BC, className: "bottom-3 left-1/2 -translate-x-1/2", label: "가운데 아래" },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: Theme.LIGHT, label: "라이트", icon: <Sun className="w-3.5 h-3.5" /> },
  { value: Theme.DARK, label: "다크", icon: <Moon className="w-3.5 h-3.5" /> },
  { value: Theme.SYSTEM, label: "시스템", icon: <Monitor className="w-3.5 h-3.5" /> },
];

export const Setting = () => {
  const { panelPosition, setPanelPosition } = useGlobalVariable();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [reduceMotion, setReduceMotion] = useState<boolean>(
    () => localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === "true"
  );
  const [rememberLoginEmail, setRememberLoginEmail] = useState<boolean>(
    () => localStorage.getItem(REMEMBER_LOGIN_EMAIL_STORAGE_KEY) === "true"
  );

  // 토글 값이 바뀔 때마다 <html data-reduce-motion="..."> 을 갱신 (index.css의 전역 규칙이 이를 읽는다)
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(reduceMotion));
  }, [reduceMotion]);

  // 로그인 이메일 기억 여부를 저장. 끄면 이미 저장된 이메일도 함께 지운다.
  useEffect(() => {
    localStorage.setItem(REMEMBER_LOGIN_EMAIL_STORAGE_KEY, String(rememberLoginEmail));
    if (!rememberLoginEmail) {
      localStorage.removeItem(SAVED_LOGIN_EMAIL_STORAGE_KEY);
    }
  }, [rememberLoginEmail]);

  const handleReset = () => {
    setPanelPosition(PanelPosition.BC);
    setReduceMotion(false);
    setRememberLoginEmail(false);
    setTheme(Theme.SYSTEM);
  };

  const swatchClasses = "focus-ring border w-12 h-8 rounded-sm absolute transition-colors cursor-pointer";

  return (
    <PanelShell title="설정">
      <div className="flex flex-col gap-4 h-full min-h-0">
        {/* 스크롤되는 설정 목록 (패널 600×300 본문 넘침 대응) */}
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* 테마 */}
          <PanelSection title="테마" description="화면에 적용할 색상 테마를 선택하세요.">
            <SegmentedControl
              options={THEME_OPTIONS}
              value={theme}
              onChange={setTheme}
              label="테마 선택"
            />
            {theme === Theme.SYSTEM ? (
              <p className="text-xs text-content-subtle">
                현재 시스템 설정은 {resolvedTheme === ResolvedTheme.DARK ? "다크" : "라이트"} 모드입니다.
              </p>
            ) : null}
          </PanelSection>

          {/* 패널 위치 */}
          <PanelSection title="패널 위치" description="알림과 도구 패널이 표시될 위치를 선택하세요.">
            <div className="w-48 h-28 border border-border rounded-md p-2 relative bg-surface-hover">
              {POSITION_OPTIONS.map(({ position, className, label }) => (
                <button
                  key={position}
                  type="button"
                  aria-label={label}
                  aria-pressed={panelPosition === position}
                  title={label}
                  className={`${swatchClasses} ${className} ${panelPosition === position
                    ? 'bg-accent border-accent-active shadow-sm'
                    : 'bg-surface-solid border-border-strong hover:bg-surface-raised'}`}
                  onClick={() => setPanelPosition(position)}
                />
              ))}
            </div>
          </PanelSection>

          {/* 애니메이션 줄이기 */}
          <PanelSection>
            <SettingRow
              label="애니메이션 줄이기"
              description="전환 및 페이드 효과를 최소화합니다."
              htmlFor="reduce-motion"
            >
              <Toggle
                id="reduce-motion"
                checked={reduceMotion}
                onChange={setReduceMotion}
                label="애니메이션 줄이기"
              />
            </SettingRow>
          </PanelSection>

          {/* 로그인 이메일 기억하기 */}
          <PanelSection>
            <SettingRow
              label="로그인 이메일 기억하기"
              description="다음 로그인 시 이메일 입력란을 자동으로 채워줍니다."
              htmlFor="remember-login-email"
            >
              <Toggle
                id="remember-login-email"
                checked={rememberLoginEmail}
                onChange={setRememberLoginEmail}
                label="로그인 이메일 기억하기"
              />
            </SettingRow>
          </PanelSection>
        </div>

        {/* 초기화 */}
        <div className="pt-2 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="focus-ring w-full py-2 px-3 text-sm font-medium text-content-muted hover:text-content bg-surface-hover hover:bg-surface-raised rounded-lg transition-colors cursor-pointer"
          >
            설정 초기화
          </button>
        </div>
      </div>
    </PanelShell>
  )
}
