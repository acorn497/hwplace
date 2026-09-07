import { useState, useRef, useEffect } from "react"
import { ChevronLeft } from "lucide-react"
import { FetchMethod, useFetch } from "../../../../hooks/useFetch"
import { useAuth } from "../../../../contexts/Auth.context";
import { useNotification } from "../../../../contexts/Notification.context";
import { Type } from "../../../../contexts/enums/Type.enum";

const LOGIN_STATUS: Record<string, string> = {
  'E100': "이메일을 입력해주세요.",
  'E101': "올바른 이메일 형식이 아닙니다.",
  'E102': "이메일이 너무 깁니다.",
  'E110': "비밀번호를 입력해주세요.",
  'E112': "비밀번호가 너무 깁니다.",
  'A110': "일치하는 이메일과 비밀번호를 찾지 못했습니다.",
};

// 설정 패널의 "로그인 이메일 기억하기" 토글이 이 키들을 함께 사용한다.
export const REMEMBER_LOGIN_EMAIL_STORAGE_KEY = "rememberLoginEmail";
export const SAVED_LOGIN_EMAIL_STORAGE_KEY = "savedLoginEmail";

const INPUT_CLASS =
  "focus-ring w-full px-4 py-2.5 bg-surface-solid border border-border rounded-lg text-content placeholder:text-content-subtle transition-colors";

export const LoginForm = ({ setActive }: { setActive: (parameter: string) => void }) => {
  const [phase, setPhase] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState(() => {
    if (localStorage.getItem(REMEMBER_LOGIN_EMAIL_STORAGE_KEY) !== "true") return "";
    return localStorage.getItem(SAVED_LOGIN_EMAIL_STORAGE_KEY) ?? "";
  });
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { setEmail, setUsername, setAccessToken, setRole, setRestricted } = useAuth();
  const { setNotification } = useNotification();

  // Phase 전환 시 자동 포커스
  useEffect(() => {
    if (phase === 1 && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [phase]);

  // "이메일 기억하기"가 켜져 있으면 입력할 때마다 최신 이메일을 저장해둔다.
  useEffect(() => {
    if (localStorage.getItem(REMEMBER_LOGIN_EMAIL_STORAGE_KEY) !== "true") return;
    localStorage.setItem(SAVED_LOGIN_EMAIL_STORAGE_KEY, enteredEmail);
  }, [enteredEmail]);

  const handleSubmit = async () => {
    setIsLoading(true);

    const result = await useFetch(FetchMethod.POST, '/auth/login', {
      email: enteredEmail,
      password: enteredPassword,
    });

    const status = result.internalStatusCode?.toString();

    if (!status?.match('0000')) {
      const message = LOGIN_STATUS[status ?? ''] || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      setNotification({ title: '로그인', content: message, type: Type.WARNING });

      setIsLoading(false);
      return;
    }
    setEmail(result.data.email);
    setUsername(result.data.username);
    setAccessToken(result.data.accessToken);
    setRole(result.data.role === 'ADMIN' ? 'ADMIN' : 'USER');
    setRestricted(Boolean(result.data.restricted));

    setNotification({ title: '로그인', content: '로그인이 완료되었습니다.' });

    setIsLoading(false);
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();

    if (phase === 1) {
      if (!enteredPassword) return
      handleSubmit();
      return;
    }

    if (phase === 0 && !enteredEmail) return;
    setPhase(1);
  }

  const handleBack = () => {
    setPhase(0);
    setEnteredPassword("");
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext(e as unknown as React.MouseEvent);
    }
  }

  return (
    <div className="w-full min-w-0 p-2">
      <form className="flex flex-col gap-2" onKeyDown={handleKeyDown}>
        {phase !== 0 ?
          <div className="flex items-center gap-2 h-2">
            <button
              type="button"
              onClick={handleBack}
              className="focus-ring p-1 hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
              aria-label="뒤로 가기"
            >
              <ChevronLeft className="w-5 h-5 text-content-muted" />
            </button>
            <div className="text-sm text-content-muted truncate">{enteredEmail}</div>
          </div>
          : <div className="h-2" />
        }
        {/* Phase 0: 이메일 입력 */}
        {phase === 0 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-lg font-semibold text-content w-fit">
              돌아오셔서 반갑습니다!
            </label>
            <input
              id="login-email"
              type="email"
              value={enteredEmail}
              onChange={(e) => setEnteredEmail(e.target.value)}
              className={INPUT_CLASS}
              placeholder="email@example.com"
              required
              autoComplete="email"
            />
          </div>
        )}

        {/* Phase 1: 비밀번호 입력 */}
        {phase === 1 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="login-password" className="text-lg font-semibold text-content w-fit">
              비밀번호를 입력해주세요
            </label>
            <input
              ref={passwordInputRef}
              id="login-password"
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              className={INPUT_CLASS}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
            />
          </div>
        )}
      </form>

      <div className="relative flex flex-row h-14 justify-between items-center gap-2">
        {phase === 0 ?
          <div className="text-center text-xs text-content-muted">
            계정이 없으신가요?{" "}
            <button
              type="button"
              onClick={() => setActive("Register")}
              className="focus-ring text-accent font-medium hover:underline transition-colors cursor-pointer"
            >
              회원가입
            </button>
          </div>
          : <div />
        }
        <button
          type="button"
          onClick={handleNext}
          disabled={isLoading || (phase === 0 && !enteredEmail) || (phase === 1 && !enteredPassword)}
          className="focus-ring px-2 py-2 w-17 h-9 bg-accent text-accent-fg text-sm font-medium rounded-lg hover:bg-accent-hover active:bg-accent-active disabled:bg-border-strong disabled:text-content-subtle disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
        >
          {isLoading ? "..." : phase === 1 ? "로그인" : "다음"}
        </button>
      </div>
    </div>
  )
}
