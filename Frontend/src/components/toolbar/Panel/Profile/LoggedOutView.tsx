import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export const LoggedOutView = () => {
  const [active, setActive] = useState('Login');

  return (
    <div className="grid grid-cols-[1fr_1px_2fr] gap-5 h-full items-center justify-items-center">
      {/* 로고 섹션 */}
      <div className="flex flex-col items-center gap-2 pl-2">
        <h1 className="font-extrabold text-3xl tracking-tight select-none leading-6">
          <span className="text-slate-800 drop-shadow-lg">HW</span>
          <span className="text-cyan-500 drop-shadow-[0_0_10px_rgba(12,185,218,0.2)]">Place</span>
        </h1>
        <p className="text-slate-500 text-xs">로그인하고 시작하세요</p>
      </div>

      {/* 구분선 */}
      <div className="bg-slate-900/10 w-px h-full" />

      {active === "Login" ? <LoginForm setActive={setActive} /> : null}
      {active === "Register" ? <RegisterForm setActive={setActive} /> : null}
    </div>
  );
};
