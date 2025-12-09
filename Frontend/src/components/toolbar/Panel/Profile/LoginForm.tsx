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

export const LoginForm = ({ setActive }: { setActive: (parameter: string) => void }) => {
  const [phase, setPhase] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { setEmail, setUsername, setAccessToken } = useAuth();
  const { setNotification } = useNotification();

  // Phase 전환 시 자동 포커스
  useEffect(() => {
    if (phase === 1 && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [phase]);

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
    <>
      {/* 폼 섹션 */}
      <div className="w-full p-2">
        <form className="flex flex-col gap-2" onKeyDown={handleKeyDown}>
          {phase !== 0 ?
            <div className="flex items-center gap-2 h-2">
              <button
                type="button"
                onClick={handleBack}
                className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="뒤로 가기"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-sm text-slate-600 truncate">{enteredEmail}</div>
            </div>
            : <div className="h-2" />
          }
          {/* Phase 0: 이메일 입력 */}
          {phase === 0 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-lg font-semibold text-slate-700 w-fit">
                돌아오셔서 반갑습니다!
              </label>
              <input
                id="email"
                type="email"
                value={enteredEmail}
                onChange={(e) => setEnteredEmail(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="email@example.com"
                required
              />
            </div>
          )}

          {/* Phase 1: 비밀번호 입력 */}
          {phase === 1 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-lg font-semibold text-slate-700 w-fit">
                비밀번호를 입력해주세요
              </label>
              <input
                ref={passwordInputRef}
                id="password"
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="••••••••••••"
                required
              />
            </div>
          )}

        </form>
        <div className="relative flex flex-row h-14 justify-between items-center">
          {/* 회원가입 링크 */}
          {phase === 0 ?
            <div className="text-center text-xs text-slate-600">
              계정이 없으신가요?{" "}
              <button
                onClick={() => setActive("Register")}
                className="text-cyan-500 font-medium hover:text-cyan-600 hover:underline transition-colors">
                회원가입
              </button>
            </div>
            : <div></div>
          }
          {/* 버튼 */}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLoading || (phase === 0 && !enteredEmail) || (phase === 1 && !enteredPassword)}
            className="px-2 py-2 w-17 h-9 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
          >
            {isLoading ? "..." : phase === 1 ? "로그인" : "다음"}
          </button>
        </div>
      </div>
    </>
  )
}
