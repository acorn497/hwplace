import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export const LoggedOutView = () => {
  const [active, setActive] = useState('Login');

  return (
    <div className="grid grid-cols-[1fr_1px_2fr] gap-4 h-full min-h-0 items-center justify-items-center">
      {/* 로고 섹션 */}
      <div className="flex flex-col items-center gap-2 pl-2">
        <h1 className="font-extrabold text-3xl tracking-tight select-none leading-6">
          <span className="text-content">HW</span>
          <span className="text-accent">Place</span>
        </h1>
        <p className="text-content-muted text-xs">로그인하고 시작하세요</p>
      </div>

      {/* 구분선 */}
      <div className="bg-border w-px h-full min-h-24" aria-hidden />

      {active === "Login" ? <LoginForm setActive={setActive} /> : null}
      {active === "Register" ? <RegisterForm setActive={setActive} /> : null}
    </div>
  );
};
