import { useState, useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { FetchMethod, useFetch } from "../../../../hooks/useFetch";
import { useNotification } from "../../../../contexts/Notification.context";
import { Type } from "../../../../contexts/enums/Type.enum";

const TOTAL_PHASE = 2;

const REGISTER_STATUS: Record<string, string> = {
  'E100': "이메일을 입력해주세요.",
  'E101': "올바른 이메일 형식이 아닙니다.",
  'E102': "이메일이 너무 깁니다.",
  'E110': "비밀번호를 입력해주세요.",
  'E111': "비밀번호가 너무 짧습니다.",
  'E112': "비밀번호가 너무 깁니다.",
  'A100': "다른 이메일을 사용해주세요.",
  'A110': "일치하는 이메일과 비밀번호를 찾지 못했습니다.",
};

const INPUT_CLASS =
  "focus-ring w-full px-4 py-2.5 bg-surface-solid border border-border rounded-lg text-content placeholder:text-content-subtle transition-colors";

export const RegisterForm = ({ setActive }: {
  setActive: (parameter: string) => void
}) => {
  const [phase, setPhase] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [enteredPasswordConfirm, setEnteredPasswordConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordConfirmInputRef = useRef<HTMLInputElement>(null);

  const { setNotification } = useNotification();

  useEffect(() => {
    switch (phase) {
      case 1:
        passwordInputRef.current?.focus();
        break;
      case 2:
        passwordConfirmInputRef.current?.focus();
        break;
    }
  }, [phase])

  const handleSubmit = async () => {
    setIsLoading(true);

    const result = await useFetch(FetchMethod.POST, '/auth/register', {
      email: enteredEmail,
      password: enteredPassword,
    });

    const status = result.internalStatusCode?.toString();

    if (!result.internalStatusCode?.toString().match("0000")) {
      const message = REGISTER_STATUS[status ?? ''] || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      setNotification({ title: '회원가입', content: message, type: Type.WARNING });
      setIsLoading(false);
      return;
    }

    setNotification({ title: '회원가입', content: '회원가입이 완료되었습니다.' });

    setEnteredEmail('');
    setEnteredPassword('');
    setEnteredPasswordConfirm('');

    setActive('Login')

    setTimeout(() => {
      setIsLoading(false);
    }, 1000)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()

    if (phase === 1) {
      if (!enteredPassword) return;
    }

    if (phase === 2) {
      if (enteredPassword !== enteredPasswordConfirm) {
        setNotification({ title: '회원가입', content: '입력한 비밀번호와 일치하지 않습니다.', type: Type.WARNING });
        return
      };
      handleSubmit();
      return;
    }

    if (phase === 0 && !enteredEmail) return
    setPhase(prev => prev + 1)
  }

  const handleBack = () => {
    setPhase(prev => prev - 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleNext(e as unknown as React.MouseEvent)
    }
  }

  const isNextDisabled =
    isLoading
    || (phase === 0 && !enteredEmail)
    || (phase === 1 && !enteredPassword)
    || (phase === TOTAL_PHASE && !enteredPasswordConfirm);

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
            <label htmlFor="register-email" className="text-lg font-semibold text-content w-fit">
              이메일을 입력해주세요.
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-password" className="text-lg font-semibold text-content w-fit">
              새 비밀번호를 입력해주세요.
            </label>
            <input
              ref={passwordInputRef}
              id="register-password"
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              className={INPUT_CLASS}
              placeholder="••••••••••••"
              required
              autoComplete="new-password"
            />
          </div>
        )}

        {/* Phase 2: 비밀번호 확인 */}
        {phase === 2 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="register-password-confirm" className="text-lg font-semibold text-content w-fit">
              비밀번호를 다시 한번 입력해주세요.
            </label>
            <input
              ref={passwordConfirmInputRef}
              id="register-password-confirm"
              type="password"
              value={enteredPasswordConfirm}
              onChange={(e) => setEnteredPasswordConfirm(e.target.value)}
              className={INPUT_CLASS}
              placeholder="••••••••••••"
              required
              autoComplete="new-password"
            />
          </div>
        )}
      </form>

      <div className="relative flex flex-row h-14 justify-between items-center gap-2">
        {phase === 0 ?
          <div className="text-center text-xs text-content-muted">
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              onClick={() => setActive("Login")}
              className="focus-ring text-accent font-medium hover:underline transition-colors cursor-pointer"
            >
              로그인
            </button>
          </div>
          : <div />
        }
        <button
          type="button"
          onClick={handleNext}
          disabled={isNextDisabled}
          className="focus-ring px-2 py-2 w-17 h-9 bg-accent text-accent-fg text-sm font-medium rounded-lg hover:bg-accent-hover active:bg-accent-active disabled:bg-border-strong disabled:text-content-subtle disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
        >
          {isLoading ? "..." : phase === TOTAL_PHASE ? "회원가입" : "다음"}
        </button>
      </div>
    </div>
  )
}
