import { ReactNode, useEffect, useRef, useState } from "react";

// 버튼 색상 스타일. 기본값은 강조(액센트) 버튼으로, 기존 동작과 동일하다.
export type ButtonVariant = 'accent' | 'subtle' | 'ghost';

interface ButtonProps {
  display?: string | number,
  hint?: string,
  className?: string,
  callback?: () => void,
  keybind?: string,
  disabled?: boolean,
  children?: ReactNode,
  variant?: ButtonVariant,
}

// ms
const TRIGGER_TTL = 500

// variant별 배경/글자/hover·active 색상과 그림자를 한 곳에 모아 관리한다.
// disabled 상태는 variant와 무관하게 버튼 자체 className에서 공통 처리한다.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent: "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow-md active:bg-accent-active",
  subtle: "bg-surface-hover text-content border border-border hover:bg-surface-raised active:bg-surface-raised",
  ghost: "bg-transparent text-content-muted hover:bg-surface-hover hover:text-content",
};

export const Button = ({ display, hint, className, callback, keybind, disabled, children, variant = 'accent' }: ButtonProps) => {
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  const clearHintTimer = () => {
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  };

  // 컴포넌트가 사라질 때 타이머가 남아있지 않도록 정리
  useEffect(() => clearHintTimer, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    clearHintTimer();
    hintTimerRef.current = window.setTimeout(() => setShowHint(true), TRIGGER_TTL);
  };

  const handleMouseLeave = () => {
    clearHintTimer();
    setShowHint(false);
  };

  const handleOnClick = () => {
    if (disabled) return;
    callback?.();
  }

  return (
    <div className="relative w-fit p-1" onMouseLeave={handleMouseLeave}>
      {hint ?
        <div className={`${showHint ? "opacity-100" : "opacity-0 select-none pointer-events-none"} absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-fit overflow-hidden transition-normal duration-200 bg-content/80 backdrop-blur-md py-1 px-2 text-sm rounded-md text-app-bg font-medium whitespace-nowrap`}>
          <span>{hint}</span>
          {keybind ?
            <><br /><span className="text-xs font-light">Key </span><span className="text-xs italic">{keybind}</span></>
            : null}
        </div>
        : null}
      <button
        type="button"
        disabled={disabled}
        className={`py-2 px-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:bg-surface-hover disabled:text-content-subtle disabled:shadow-none disabled:cursor-not-allowed focus-ring ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
        onClick={handleOnClick}
        onMouseEnter={handleMouseEnter}
      >
        {display}
        {children}
      </button>
    </div >
  )
}
