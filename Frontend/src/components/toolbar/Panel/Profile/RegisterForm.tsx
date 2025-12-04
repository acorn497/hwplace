import { useState, useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { FetchMethod, useFetch } from "../../../../hooks/useFetch";

const TOTAL_PHASE = 2;

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

  // Phase 전환 시 자동 포커스
  useEffect(() => {
    switch (phase) {
      case 1:
        passwordInputRef.current ? passwordInputRef.current.focus() : null;
        break;
      case 2:
        passwordConfirmInputRef.current ? passwordConfirmInputRef.current.focus() : null;
        break;
    }
  }, [phase])

  const handleSubmit = async () => {
    setIsLoading(true);

    const result = await useFetch(FetchMethod.POST, '/auth/register', {
      email: enteredEmail,
      password: enteredPassword,
    });

    console.log(result)

    if (!result.internalStatusCode?.toString().match("0000")) {
      console.log("Failed To Register");
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()

    if (phase === 1) {
      if (!enteredPassword) return;
    }

    if (phase === 2) {
      if (enteredPassword !== enteredPasswordConfirm) return;
      handleSubmit();
      return;
    }

    if (phase === 0 && !enteredEmail) return
    setPhase(prev => prev + 1)
  }

  const handleBack = () => {
    setPhase(prev => prev - 1)
    setEnteredPassword("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleNext(e as unknown as React.MouseEvent)
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
              <label htmlFor="email" className="text-lg font-semibold text-slate-700 w-fit">이메일을 입력해주세요.</label>
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

              <label htmlFor="password" className="text-lg font-semibold text-slate-700 w-fit">새 비밀번호를 입력해주세요.</label>
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

          {/* Phase 2: 비밀번호 확인 */}
          {phase === 2 && (
            <div className="flex flex-col gap-2">

              <label htmlFor="password" className="text-lg font-semibold text-slate-700 w-fit">비밀번호를 다시 한번 입력해주세요.</label>
              <input
                ref={passwordConfirmInputRef}
                id="password"
                type="password"
                value={enteredPasswordConfirm}
                onChange={(e) => setEnteredPasswordConfirm(e.target.value)}
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
              이미 계정이 있으신가요?{" "}
              <button
                onClick={() => setActive("Login")}
                className="text-cyan-500 font-medium hover:text-cyan-600 hover:underline transition-colors">
                로그인
              </button>
            </div>
            : <div></div>
          }
          {/* 버튼 */}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLoading || (phase === 0 && !enteredEmail) || (phase === TOTAL_PHASE && !enteredPassword)}
            className="px-2 py-2 w-17 h-9 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
          >
            {isLoading ? "..." : phase === TOTAL_PHASE ? "회원가입" : "다음"}
          </button>
        </div>
      </div>
    </>
  )
}