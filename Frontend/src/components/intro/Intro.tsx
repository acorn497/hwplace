import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Check, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";
import { useSocket } from "../../contexts/Socket.context";
import { usePixel } from "../../contexts/Pixel.context.tsx";
import { useCanvas } from "../../contexts/Canvas.context.tsx";
import { CanvasStatus } from "../../contexts/enums/CanvasStatus.enum.ts";
import { ConnectionStatus } from "../../contexts/enums/ConnectionStatus.enum.ts";
import { PixelLoadStatus } from "../../contexts/enums/PixelLoadStatus.enum.ts";

/* ========================================================================
 * 타이밍 (ms)
 *
 * 인트로는 자기 퇴장 시점을 스스로 계산해 onFinished로 알린다.
 * (예전에는 App.tsx가 상수 세 개를 더해 언마운트 시점을 역산했다 — 한쪽만 고치면 어긋났다)
 * ======================================================================== */

/** 로고가 페이드 인 하며 올라오는 시간 */
const LOGO_ENTER_MS = 520;

/**
 * 로딩 UI를 펼치기까지 기다리는 시간.
 *
 * 이 안에 로딩이 끝나면 로딩 UI는 **아예 뜨지 않는다**.
 * 이미 끝난 작업의 진행 막대가 뒤늦게 나타났다 사라지는 것만큼 나쁜 연출은 없다.
 *
 * 값의 근거: 1초 이내로 끝나는 작업은 진행 표시가 있어야 할 만큼 길지 않다.
 * 그 아래에서는 표시를 띄우는 것 자체가 "기다렸다"는 인상만 만든다.
 * 이 구간에도 화면이 비어 있지는 않다 — 로고가 자리를 지킨다.
 */
const LOADING_REVEAL_DELAY = 700;

/** 로고 등장 연출이 중간에 잘리지 않도록 보장하는 인트로 최소 체류 시간 */
const INTRO_MIN_DWELL = 720;

/** 100% 도달 후 완성된 모자이크를 보여주는 시간 (로딩 UI가 펼쳐졌을 때만) */
const COMPLETE_HOLD = 560;

/** 로딩 UI가 접히고 펼쳐지는 시간 */
const LOADING_EXPAND_MS = 460;

/** 인트로 페이드 아웃 시간 */
const INTRO_EXIT_MS = 420;

/** 로딩 UI 내부 요소들이 순서대로 등장하는 시차 */
const STAGGER = {
  status: 0,
  mosaic: 70,
  steps: 140,
  tip: 210,
} as const;

/** 진행률이 이 시간 동안 변하지 않으면 "느린 것 같다"고 솔직하게 알린다 */
const STALL_HINT_DELAY = 9000;

const TIP_INTERVAL = 4500;
const TIP_FADE = 220;

/**
 * 단계별 진행률 구간.
 *
 * 픽셀 렌더링은 청크가 도착할 때마다 곧바로 일어나므로 별도 단계가 아니다.
 * (예전에는 이미 끝난 렌더링을 뒤늦게 재생하는 가짜 구간이 있었다)
 */
const CONNECT_END = 8;

type StepId = "connect" | "chunk";
type StepState = "pending" | "active" | "done" | "failed";

const STEP_ORDER: StepId[] = ["connect", "chunk"];
const STEP_TITLE: Record<StepId, string> = {
  connect: "서버 연결",
  chunk: "캔버스 받기",
};
/** 현재 단계를 큰 글씨로 알려주는 문장 */
const STEP_HEADLINE: Record<StepId, string> = {
  connect: "서버에 연결하는 중",
  chunk: "캔버스를 그리는 중",
};

// ========================================
// -- 등장 연출 래퍼
// ========================================
/**
 * 아래에서 위로 떠오르며 나타난다.
 *
 * duration/delay를 인라인 스타일로 두는 이유:
 *  - 두 값이 JS 상수(STAGGER 등)에서 나오므로 Tailwind의 정적 클래스로 표현할 수 없다.
 *  - "애니메이션 줄이기"의 `transition-duration: !important`가 인라인 값을 이긴다.
 *    (delay는 index.css에서 함께 0으로 눌러준다)
 */
const Reveal = ({
  show,
  delay = 0,
  duration = 420,
  className = "",
  children,
}: PropsWithChildren<{ show: boolean; delay?: number; duration?: number; className?: string }>) => (
  <div
    className={`transition-[opacity,transform] ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${className}`}
    style={{
      transitionDuration: `${duration}ms`,
      // 사라질 때는 시차 없이 한꺼번에 (퇴장은 루트 페이드가 담당한다)
      transitionDelay: show ? `${delay}ms` : "0ms",
    }}
  >
    {children}
  </div>
);

// ========================================
// -- 픽셀 모자이크 = 진행 막대 (채워진 칸 수가 곧 진행률)
//
// 예전에는 모자이크와 별도의 진행 막대가 같은 값을 두 번 보여줬다.
// 지표를 하나로 합치고 3행 띠로 낮춰, 로고 대비 부피를 줄인다.
// 칸이 72개라 청크 256개를 약 3.5개 단위로 표현한다 — 눈에 띄는 계단은 없다.
// ========================================
const MOSAIC_COLS = 24;
const MOSAIC_ROWS = 3;
const MOSAIC_CELLS = MOSAIC_COLS * MOSAIC_ROWS;

/**
 * 액센트 계열로 폭을 좁힌다.
 * 채도 폭이 넓으면 채워지는 것이 "캔버스"가 아니라 "색종이 조각"으로 읽힌다.
 * 라이트/다크 양쪽에서 모두 읽히는 명도만 고른다.
 */
const MOSAIC_PALETTE = ["#0891b2", "#06b6d4", "#22d3ee", "#38bdf8"];

interface MosaicCell {
  /** 몇 번째로 채워지는 칸인지 (0 ~ MOSAIC_CELLS-1) */
  rank: number;
  color: string;
}

/**
 * 채워지는 순서를 미리 계산한다.
 * 완전 무작위는 지저분해 보이므로 "왼쪽 → 오른쪽 물결 + 약간의 흐트러짐"으로 만든다.
 * 시드를 고정해 리렌더마다 배치가 바뀌지 않게 한다.
 */
const createMosaic = (): MosaicCell[] => {
  let seed = 20260907;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const cells = Array.from({ length: MOSAIC_CELLS }, (_, index) => {
    const column = index % MOSAIC_COLS;
    return {
      index,
      // 물결(0~1)에 흐트러짐을 더해 정렬 기준을 만든다.
      // 3행 띠에서는 흐트러짐이 크면 채워진 덩어리에서 칸이 떨어져 나와 "노이즈"로 읽힌다.
      // 진행 경계가 두세 칸 안에서만 들쭉날쭉하도록 폭을 좁혔다.
      sortKey: column / (MOSAIC_COLS - 1) + random() * 0.12,
      color: MOSAIC_PALETTE[Math.floor(random() * MOSAIC_PALETTE.length)],
    };
  });

  const result: MosaicCell[] = new Array(MOSAIC_CELLS);
  [...cells]
    .sort((a, b) => a.sortKey - b.sortKey)
    .forEach((cell, rank) => {
      result[cell.index] = { rank, color: cell.color };
    });

  return result;
};

const PixelMosaic = ({ progress, failed }: { progress: number; failed: boolean }) => {
  const cells = useMemo(createMosaic, []);
  const filledCount = Math.round((progress / 100) * MOSAIC_CELLS);

  return (
    <div
      aria-hidden
      className={`grid gap-[2px] transition-all duration-500 ${failed ? "grayscale opacity-40" : ""}`}
      style={{ gridTemplateColumns: `repeat(${MOSAIC_COLS}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, index) => {
        const filled = cell.rank < filledCount;
        return (
          <div
            key={index}
            className="aspect-square rounded-[2px] transition-all duration-300 ease-out"
            style={{
              backgroundColor: filled ? cell.color : "var(--hw-surface-hover)",
              opacity: filled ? 1 : 0.55,
              transform: filled ? "scale(1)" : "scale(0.72)",
              // 같은 순번대들이 통째로 튀어나오지 않도록 아주 짧은 시차를 준다
              transitionDelay: filled ? `${(cell.rank % MOSAIC_ROWS) * 12}ms` : "0ms",
            }}
          />
        );
      })}
    </div>
  );
};

// ========================================
// -- 단계 표시 한 줄
// ========================================
const StepRow = ({
  state,
  title,
  detail,
}: {
  state: StepState;
  title: string;
  detail: string;
}) => {
  const icon = {
    done: <Check className="w-3 h-3 text-ok" />,
    active: <LoaderCircle className="w-3 h-3 text-accent animate-spin" />,
    failed: <TriangleAlert className="w-3 h-3 text-danger" />,
    pending: <div className="w-1.5 h-1.5 rounded-full border border-border-strong" />,
  }[state];

  const titleTone = {
    done: "text-content-muted",
    active: "text-content font-medium",
    failed: "text-danger font-medium",
    pending: "text-content-subtle",
  }[state];

  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span className="w-3.5 flex items-center justify-center shrink-0">{icon}</span>
      <span className={`shrink-0 ${titleTone}`}>{title}</span>
      <span className="flex-1 h-px bg-border" />
      <span
        className={`shrink-0 tabular-nums ${state === "failed" ? "text-danger" : "text-content-subtle"}`}
      >
        {detail}
      </span>
    </li>
  );
};

// ========================================
// -- 로딩 중 보여줄 사용법 팁 (실제로 있는 기능만 적을 것)
// ========================================
const TIPS = [
  "휠을 굴려 캔버스를 확대하고 축소합니다.",
  "휠 클릭(가운데 버튼) 드래그나 스페이스바 + 드래그로 캔버스를 옮깁니다.",
  "스포이드로 캔버스 위의 색을 그대로 집어올 수 있습니다.",
  "설정 패널에서 다크 모드와 애니메이션 줄이기를 켤 수 있습니다.",
  "여기 찍는 픽셀은 접속한 모두에게 실시간으로 전달됩니다.",
];

interface IntroProps {
  /** 퇴장 연출까지 모두 끝나 언마운트해도 되는 시점에 호출된다 */
  onFinished: () => void;
}

export const Intro = ({ onFinished }: IntroProps) => {
  const { connectionStatus, isConnected, startConnection, retryConnection } = useSocket();
  const { loadedChunk, totalChunk, pixelLoadStatus } = usePixel();
  const { canvasStatus, setCanvasStatus } = useCanvas();

  /** 첫 페인트 이후 true가 되어 등장 연출을 시작시킨다 */
  const [entered, setEntered] = useState(false);
  /** 로딩 UI가 실제로 펼쳐진 시각. null이면 "아직 안 펼쳤다" 또는 "끝내 펼치지 않는다" */
  const [loadingShownAt, setLoadingShownAt] = useState<number | null>(null);
  const mountedAtRef = useRef(performance.now());

  const [fadeOut, setFadeOut] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isStalled, setIsStalled] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  /** 재시도 때 완료 타이머/진행률이 이전 세션 값을 물고 있지 않도록 세션을 구분한다 */
  const [attempt, setAttempt] = useState(0);

  const loadingVisible = loadingShownAt !== null;

  const connectionFailed = connectionStatus === ConnectionStatus.FAILED;
  const dataFailed = pixelLoadStatus === PixelLoadStatus.FAILED;
  const hasFailed = connectionFailed || dataFailed;
  /** 소켓이 스스로 재시도 중인 상태. 실패로 단정하지 않고 있는 그대로 알린다. */
  const isReconnecting =
    !hasFailed &&
    connectRequested &&
    (connectionStatus === ConnectionStatus.ERROR || connectionStatus === ConnectionStatus.DISCONNECTED);

  // ========================================
  // -- 진행률 계산
  // ========================================
  const rawProgress = useMemo(() => {
    if (canvasStatus === CanvasStatus.FINISHED) return 100;
    if (pixelLoadStatus === PixelLoadStatus.FINISHED) return 100;

    // 청크 구간 (8% ~ 100%) — 청크가 도착하는 즉시 화면에도 그려진다
    if (totalChunk > 0) {
      return CONNECT_END + (Math.min(loadedChunk, totalChunk) / totalChunk) * (100 - CONNECT_END);
    }

    // 연결 구간 (0% ~ 8%)
    // 연결 전에는 진행률이 존재하지 않는다. "뭔가 하고 있다"는 신호로 3% 같은 값을
    // 지어내면 막대가 처음부터 차 있는 것처럼 보인다. 그 신호는 단계 행의
    // 스피너와 헤드라인이 이미 맡고 있다.
    if (isConnected) return CONNECT_END;
    return 0;
  }, [canvasStatus, pixelLoadStatus, totalChunk, loadedChunk, isConnected]);

  // 진행률은 절대 뒤로 가지 않는다 (재연결 중 값이 튀어도 사용자에게는 후퇴로 보이지 않게)
  useEffect(() => {
    setProgress((prev) => (rawProgress > prev ? rawProgress : prev));
  }, [rawProgress]);

  const isComplete = progress >= 100;
  const percentage = Math.min(100, Math.round(progress));
  const currentStep: StepId = useMemo(() => (isConnected ? "chunk" : "connect"), [isConnected]);

  const stepState = (step: StepId): StepState => {
    const stepIndex = STEP_ORDER.indexOf(step);
    const currentIndex = STEP_ORDER.indexOf(currentStep);

    if (step === "connect" && connectionFailed) return "failed";
    if (step === "chunk" && dataFailed) return "failed";
    if (progress >= 100) return "done";
    if (stepIndex < currentIndex) return "done";
    if (stepIndex > currentIndex) return "pending";
    return hasFailed ? "pending" : "active";
  };

  /** 각 단계 오른쪽에 붙는 정확한 수치 */
  const stepDetail = (step: StepId): string => {
    const state = stepState(step);
    if (state === "pending") return "대기";

    switch (step) {
      case "connect":
        if (state === "failed") return "실패";
        if (isConnected) return "완료";
        return isReconnecting ? "재시도 중" : "연결 중";
      case "chunk":
        if (state === "failed") return "실패";
        if (!totalChunk) return "정보 요청 중";
        return `${Math.min(loadedChunk, totalChunk).toLocaleString()} / ${totalChunk.toLocaleString()} 청크`;
    }
  };

  // ========================================
  // -- 연결 시작 & 로고 등장
  // ========================================
  useEffect(() => {
    // 로딩은 즉시 시작한다. 로고 연출은 그 위에 겹쳐서 보여줄 뿐 작업을 미루지 않는다.
    setConnectRequested(true);
    startConnection();
  }, [startConnection]);

  useEffect(() => {
    // 첫 페인트가 "숨은 상태"로 한 번 끝나야 transition이 걸린다 (rAF 두 번이 확실하다)
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  // ========================================
  // -- 로딩 UI 등장 (충분히 빠르면 아예 펼치지 않는다)
  // ========================================
  useEffect(() => {
    if (loadingVisible) return;

    // 실패하면 재시도 버튼이 로딩 UI 안에 있으므로 지체 없이 펼친다
    if (hasFailed) {
      setLoadingShownAt(performance.now());
      return;
    }
    // 이미 끝났다면 펼치지 않는다 — 다 찬 진행 막대를 이제 와서 보여줄 이유가 없다
    if (isComplete) return;

    const wait = Math.max(0, LOADING_REVEAL_DELAY - (performance.now() - mountedAtRef.current));
    const timer = window.setTimeout(() => setLoadingShownAt(performance.now()), wait);
    return () => window.clearTimeout(timer);
  }, [loadingVisible, hasFailed, isComplete]);

  // ========================================
  // -- 퇴장: 두 가지 최소 조건 중 늦은 시점을 따른다
  // ========================================
  useEffect(() => {
    if (!isComplete || hasFailed) return;

    setCanvasStatus(CanvasStatus.FINISHED);

    const now = performance.now();
    const notBefore = Math.max(
      // 1) 로고 등장 연출이 중간에 잘리지 않을 것
      mountedAtRef.current + INTRO_MIN_DWELL,
      // 2) 로딩 UI를 펼쳤다면 다 채워진 모자이크를 잠깐 보여줄 것.
      //    로딩 UI는 "아직 안 끝났을 때"만 펼치므로 완료는 항상 그 뒤에 온다.
      //    따라서 이 조건 하나가 "최소 노출 시간"까지 겸한다 — 깜빡일 수 없다.
      loadingShownAt !== null ? now + COMPLETE_HOLD : now,
    );
    const delay = Math.max(0, notBefore - now);

    const fadeTimer = window.setTimeout(() => setFadeOut(true), delay);
    const finishTimer = window.setTimeout(onFinished, delay + INTRO_EXIT_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [isComplete, hasFailed, loadingShownAt, setCanvasStatus, onFinished]);

  // ========================================
  // -- 정체 감지: 진행률이 갱신될 때마다 타이머를 다시 잡는다
  // ========================================
  useEffect(() => {
    if (isComplete || hasFailed) {
      setIsStalled(false);
      return;
    }

    setIsStalled(false);
    const timer = window.setTimeout(() => setIsStalled(true), STALL_HINT_DELAY);
    return () => window.clearTimeout(timer);
  }, [progress, isComplete, hasFailed, attempt]);

  // ========================================
  // -- 팁 순환 (기다리는 동안 심심하지 않도록)
  // ========================================
  useEffect(() => {
    // 로딩 UI를 펼치지 않았다면 팁도 돌 필요가 없다
    if (!loadingVisible || hasFailed || isComplete) return;

    const timer = window.setInterval(() => {
      setTipVisible(false);
      window.setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
        setTipVisible(true);
      }, TIP_FADE);
    }, TIP_INTERVAL);

    return () => window.clearInterval(timer);
  }, [loadingVisible, hasFailed, isComplete]);

  const handleRetry = useCallback(() => {
    setProgress(0);
    setIsStalled(false);
    setAttempt((prev) => prev + 1);
    retryConnection();
  }, [retryConnection]);

  const headline = hasFailed
    ? connectionFailed
      ? "서버에 연결하지 못했습니다"
      : "캔버스를 불러오지 못했습니다"
    : isComplete
      ? "캔버스 준비 완료"
      : isReconnecting
        ? "다시 연결하는 중"
        : STEP_HEADLINE[currentStep];

  const subline = hasFailed
    ? connectionFailed
      ? "네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      : "서버에서 캔버스 데이터를 받지 못했습니다. 다시 시도해 주세요."
    : isComplete
      ? "잠시 후 캔버스로 이동합니다."
      : isStalled
        ? "예상보다 오래 걸리고 있습니다."
        : stepDetail(currentStep);

  return (
    <div
      className={`w-screen h-screen flex flex-col justify-center items-center bg-app-bg transition-[opacity,transform] ease-out ${fadeOut ? "opacity-0 scale-[1.03]" : "opacity-100 scale-100"} absolute z-50 overflow-hidden`}
      style={{ transitionDuration: `${INTRO_EXIT_MS}ms` }}
    >
      {/* 배경 광원 - 테마 토큰을 쓰므로 라이트/다크 모두에서 자연스럽다 */}
      <div className="pointer-events-none absolute w-[38rem] h-[38rem] rounded-full bg-accent-soft blur-3xl opacity-40" />

      <div className="relative w-full max-w-sm px-8 flex flex-col items-center">
        {/* 로고 — 마운트 즉시 떠오른다 */}
        <Reveal show={entered} duration={LOGO_ENTER_MS} className="text-center">
          <h1 className="font-bold text-5xl tracking-tight select-none">
            <span className="text-content">HW</span>
            <span className="text-accent">Place</span>
          </h1>
          <p className="mt-1.5 text-content-subtle text-sm tracking-wide">
            Collaborative Canvas
          </p>
        </Reveal>

        {/*
          로딩 UI는 자리를 미리 차지하지 않는다.
          0fr → 1fr 로 높이를 늘려 펼치므로, 로딩이 빨라 끝내 펼쳐지지 않으면
          로고가 화면 정중앙에 그대로 남는다.
        */}
        <div
          className="w-full grid transition-[grid-template-rows] ease-out"
          style={{
            gridTemplateRows: loadingVisible ? "1fr" : "0fr",
            transitionDuration: `${LOADING_EXPAND_MS}ms`,
          }}
          aria-hidden={!loadingVisible}
        >
          <div className="overflow-hidden">
            <div
              className="mt-7 flex flex-col items-stretch gap-3"
              role="progressbar"
              aria-label="캔버스 불러오는 중"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
            >
              {/* 현재 상태 문장 + 퍼센트 (막대 위 라벨) */}
              <Reveal show={loadingVisible} delay={STAGGER.status}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-content truncate leading-tight" aria-live="polite">
                      {headline}
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] truncate tabular-nums leading-tight ${hasFailed ? "text-danger" : isStalled ? "text-warn" : "text-content-muted"}`}
                    >
                      {subline}
                    </p>
                  </div>
                  <span
                    className={`text-base font-semibold tabular-nums leading-none shrink-0 ${hasFailed ? "text-danger" : "text-accent"}`}
                  >
                    {percentage}
                    <span className="ml-px text-[11px] font-normal text-content-subtle">%</span>
                  </span>
                </div>
              </Reveal>

              {/* 진행 막대를 겸하는 미니 캔버스 */}
              <Reveal show={loadingVisible} delay={STAGGER.mosaic}>
                <PixelMosaic progress={progress} failed={hasFailed} />
              </Reveal>

              {/* 단계별 상세 */}
              <Reveal show={loadingVisible} delay={STAGGER.steps}>
                <ul className="flex flex-col gap-1.5">
                  {STEP_ORDER.map((step) => (
                    <StepRow
                      key={step}
                      state={stepState(step)}
                      title={STEP_TITLE[step]}
                      detail={stepDetail(step)}
                    />
                  ))}
                </ul>
              </Reveal>

              {/* 실패 시 재시도 / 평소에는 팁 */}
              <Reveal show={loadingVisible} delay={STAGGER.tip}>
                <div className="min-h-6 flex items-center justify-center">
                  {hasFailed ? (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="focus-ring flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      다시 시도
                    </button>
                  ) : (
                    <p
                      className={`text-[10.5px] text-content-subtle text-center transition-opacity duration-200 ${tipVisible && !isComplete ? "opacity-100" : "opacity-0"}`}
                    >
                      {TIPS[tipIndex]}
                    </p>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
