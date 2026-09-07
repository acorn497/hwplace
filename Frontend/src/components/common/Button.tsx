import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  /**
   * 바깥 컨테이너 폭을 꽉 채운다.
   * 기본값(false)은 내용 크기에 맞춰지므로 기존 호출부 동작은 그대로다.
   */
  fullWidth?: boolean,
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

export const Button = ({ display, hint, className, callback, keybind, disabled, children, variant = 'accent', fullWidth = false }: ButtonProps) => {
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  /** 툴팁을 화면 좌표로 띄우기 위한 위치 (뷰포트 기준) */
  const [hintPosition, setHintPosition] = useState<{ left: number; top: number } | null>(null);

  /*
    툴팁은 패널 안에 그리면 패널의 overflow-hidden(슬라이드 애니메이션용)에 잘린다.
    body로 portal 시키고 버튼의 화면 좌표를 직접 계산해 띄운다.
    좌우로도 화면 밖으로 나가지 않도록 뷰포트 안으로 밀어 넣는다.
  */
  const measureHint = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    setHintPosition({ left: rect.left + rect.width / 2, top: rect.top });
  }, []);

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
    hintTimerRef.current = window.setTimeout(() => {
      measureHint();
      setShowHint(true);
    }, TRIGGER_TTL);
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
    <div ref={wrapperRef} className={`relative p-1 ${fullWidth ? 'w-full' : 'w-fit'}`} onMouseLeave={handleMouseLeave}>
      {hint && showHint && hintPosition
        ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-[min(20rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-full rounded-md bg-content/85 px-2 py-1 text-sm font-medium text-app-bg shadow-lg backdrop-blur-md"
            style={{
              // 좌우 가장자리에서 화면 밖으로 나가지 않도록 8px 여백 안쪽으로 가둔다
              left: Math.min(Math.max(hintPosition.left, 8), window.innerWidth - 8),
              top: hintPosition.top - 4,
            }}
          >
            <span>{hint}</span>
            {keybind ?
              <><br /><span className="text-xs font-light">Key </span><span className="text-xs italic">{keybind}</span></>
              : null}
          </div>,
          document.body,
        )
        : null}
      <button
        type="button"
        disabled={disabled}
        className={`py-2 px-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:bg-surface-hover disabled:text-content-subtle disabled:shadow-none disabled:cursor-not-allowed focus-ring ${fullWidth ? 'w-full' : ''} ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
        onClick={handleOnClick}
        onMouseEnter={handleMouseEnter}
      >
        {display}
        {children}
      </button>
    </div >
  )
}
