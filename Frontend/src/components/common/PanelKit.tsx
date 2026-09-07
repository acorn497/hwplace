import { ReactNode } from "react";

/**
 * 제어 패널(툴바 패널) 내부에서 공통으로 쓰이는 조립용 프리미티브 모음.
 *
 * 패널마다 헤더 마크업과 라벨 스타일을 각자 복사해 쓰던 것을 여기로 모았다.
 * 새 패널을 만들거나 기존 패널을 손볼 때는 반드시 이 컴포넌트들을 사용할 것.
 */

/**
 * 패널 전체를 감싸는 껍데기. 헤더 + 본문 영역을 일정하게 유지한다.
 * 본문은 남는 높이를 모두 차지하며, 넘칠 경우 본문만 스크롤된다.
 */
export const PanelShell = ({
  title,
  actions,
  children,
}: {
  title: string;
  /** 헤더 오른쪽에 놓을 보조 요소 (상태 뱃지 등) */
  actions?: ReactNode;
  children?: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-2.5 h-full min-h-0">
      <header className="flex items-center justify-between gap-2 pb-1.5 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-content">{title}</h2>
        {actions ? <div className="flex items-center gap-1.5 shrink-0">{actions}</div> : null}
      </header>
      {/*
        내용이 넘치면 스크롤되게 하되, 좌우로는 자르지 않는다.
        focus-ring이 outline-offset으로 요소 '바깥'에 그려지기 때문에
        overflow-y-auto만 걸면 가장자리 입력창의 포커스 링과 그림자가 잘려 보인다.
        (overflow-y를 지정하면 overflow-x는 자동으로 auto가 되므로 x를 명시적으로 visible로 둘 수 없어,
         대신 안쪽 여백을 줘서 링이 그려질 자리를 확보한다)
      */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 -mx-1">
        {children}
      </div>
    </div>
  );
};

/**
 * 패널 안의 한 구획. 제목 + 설명 + 내용.
 */
export const PanelSection = ({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <section className={`flex flex-col gap-2 ${className ?? ''}`}>
      {(title || description) ?
        <div className="flex flex-col gap-0.5">
          {title ? <h3 className="text-sm font-medium text-content">{title}</h3> : null}
          {description ? <p className="text-xs text-content-muted">{description}</p> : null}
        </div>
        : null}
      {children}
    </section>
  );
};

/**
 * 왼쪽에 라벨/설명, 오른쪽에 컨트롤을 두는 설정 한 줄.
 */
export const SettingRow = ({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) => {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium text-content block truncate">{label}</label>
        {description ? <p className="text-xs text-content-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
};

/**
 * on/off 스위치.
 */
export const Toggle = ({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 스크린리더용 이름 */
  label: string;
  id?: string;
}) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${checked ? 'bg-accent' : 'bg-border-strong'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
};

/**
 * 몇 개 안 되는 선택지를 가로로 나열하는 컨트롤.
 * (테마 선택, 색상 포맷 선택 등)
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  /** 스크린리더용 그룹 이름 */
  label: string;
}) => {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-hover border border-border">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${isActive
              ? 'bg-accent text-accent-fg shadow-sm'
              : 'text-content-muted hover:text-content hover:bg-surface-hover'}`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * 수치/상태를 보여주는 작은 타일. (서비스 정보 패널 등)
 */
export const MetricTile = ({
  icon,
  label,
  value,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) => {
  return (
    <div className={`flex min-h-0 flex-col justify-center gap-0.5 px-2.5 py-2 rounded-lg bg-surface-hover border border-border ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 text-content-muted">
        {icon}
        <span className="text-[11px] font-medium truncate">{label}</span>
      </div>
      <div className="text-base font-bold text-content truncate leading-tight">{value}</div>
    </div>
  );
};

/**
 * 로그인이 필요한 패널에서 쓰는 안내 블록.
 */
export const LoginGate = ({ message, onGoToLogin }: { message: string; onGoToLogin: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <h3 className="text-sm font-semibold text-content">{message}</h3>
      <button
        type="button"
        onClick={onGoToLogin}
        className="focus-ring px-3 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover active:bg-accent-active transition-colors shadow-sm cursor-pointer"
      >
        로그인 하러 가기
      </button>
    </div>
  );
};
