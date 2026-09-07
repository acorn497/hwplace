import { useCallback, useMemo, useRef, useState } from "react";
import { Play, Pause, X, Loader2, SkipBack, Gauge, Clock, FastForward } from "lucide-react";
import { useReplay } from "../../contexts/Replay.context";

/** 'events' 모드 배속 (초당 픽셀 수 배율) */
const EVENT_SPEEDS = [1, 2, 5, 20, 100];
/** 'realtime' 모드 배속 (실제 시간 배율. 기본 60배에 곱해진다) */
const REALTIME_SPEEDS = [1, 5, 30, 120, 600];

/** 건너뛴 시간을 사람이 읽게 */
const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 ${minutes % 60}분`;
};

/** 사람이 읽는 시각 (초까지) */
const formatTime = (ms: number) => {
  if (!Number.isFinite(ms)) return "--";
  return new Date(ms).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

/**
 * 리플레이 타임라인 + 재생 컨트롤.
 * 리플레이 모드일 때만 캔버스 위에 뜬다.
 */
export const ReplayBar = () => {
  const {
    status, timeline, error, exit,
    currentTime, seek, play, pause,
    speed, setSpeed, playedEvents, isBuffering,
    mode, setMode, skipIdle, setSkipIdle, activity, lastSkippedMs,
  } = useReplay();

  /** 드래그 중에는 손가락을 따라가고, 놓을 때 한 번만 seek 한다 */
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const wasPlayingRef = useRef(false);

  const range = useMemo(() => {
    if (!timeline) return null;
    const start = timeline.start.getTime();
    const end = timeline.end.getTime();
    // 이벤트가 한 시점에만 있으면 슬라이더가 0 길이가 되므로 최소 폭을 준다
    return { start, end: end > start ? end : start + 1 };
  }, [timeline]);

  const displayTime = scrubbing ?? currentTime;

  const progress = useMemo(() => {
    if (!range) return 0;
    return ((displayTime - range.start) / (range.end - range.start)) * 100;
  }, [range, displayTime]);

  const handleScrubStart = useCallback(() => {
    wasPlayingRef.current = status === 'playing';
    if (status === 'playing') pause();
  }, [status, pause]);

  const handleScrubEnd = useCallback((value: number) => {
    setScrubbing(null);
    seek(value);
    if (wasPlayingRef.current) play();
  }, [seek, play]);

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-center gap-2 border-t border-border bg-surface px-4 py-3 backdrop-blur-md text-content-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        리플레이를 불러오는 중...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 backdrop-blur-md">
        <span className="text-danger text-sm">{error ?? '리플레이를 불러오지 못했습니다.'}</span>
        <button
          onClick={exit}
          className="focus-ring rounded-md px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover cursor-pointer"
        >
          닫기
        </button>
      </div>
    );
  }

  const isPlaying = status === 'playing';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3">

        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-colors hover:bg-accent-hover cursor-pointer"
          >
            {isPlaying
              ? <Pause className="h-4 w-4" />
              : <Play className="h-4 w-4 translate-x-px" />}
          </button>

          <button
            onClick={() => range && seek(range.start)}
            aria-label="처음으로"
            title="처음으로"
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          {/* 타임라인 */}
          <div className="relative flex-1">
            {/*
              트랙. 활동량을 색 농도로 깔아 "언제 붐볐는지"를 한눈에 보이게 하고,
              그 위에 진행도를 얹는다. 빈 구간은 빗금으로 따로 표시한다.
            */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-hover">
              {range && activity?.segments.map((segment, index) => {
                if (segment.count === 0) return null;
                const left = ((segment.start - range.start) / (range.end - range.start)) * 100;
                const width = ((segment.end - segment.start) / (range.end - range.start)) * 100;
                if (left > 100 || left + width < 0) return null;
                return (
                  <span
                    key={index}
                    className="absolute inset-y-0 bg-accent"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 0.3)}%`,
                      // 활동이 적은 구간도 흔적은 보이도록 최소 농도를 준다
                      opacity: 0.22 + segment.intensity * 0.78,
                    }}
                  />
                );
              })}

              {/* 아무도 그리지 않은 구간 -- 실시간 모드에서 건너뛰는 곳 */}
              {range && activity?.gaps.map((gap, index) => {
                const left = ((gap.start - range.start) / (range.end - range.start)) * 100;
                const width = ((gap.end - gap.start) / (range.end - range.start)) * 100;
                return (
                  <span
                    key={`gap-${index}`}
                    className="absolute inset-y-0 opacity-60"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 0.2)}%`,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, var(--hw-border-strong) 0 2px, transparent 2px 4px)',
                    }}
                  />
                );
              })}

              {/* 진행도: 지나온 구간을 덮어 어디까지 봤는지 보여준다 */}
              <div
                className="absolute inset-y-0 left-0 bg-content/25"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>

            {/* 키프레임 표식: 여기로 점프하면 서버가 싸게 응답한다 */}
            {range && timeline?.keyframes.map((keyframe) => {
              const at = keyframe.at.getTime();
              if (at < range.start || at > range.end) return null;
              const left = ((at - range.start) / (range.end - range.start)) * 100;
              return (
                <span
                  key={keyframe.version}
                  title={`키프레임 · ${formatTime(at)}`}
                  className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-content-subtle"
                  style={{ left: `${left}%` }}
                />
              );
            })}

            <input
              type="range"
              aria-label="재생 위치"
              min={range?.start ?? 0}
              max={range?.end ?? 1}
              value={displayTime}
              onMouseDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              onChange={(event) => setScrubbing(Number(event.target.value))}
              onMouseUp={(event) => handleScrubEnd(Number(event.currentTarget.value))}
              onTouchEnd={(event) => handleScrubEnd(Number(event.currentTarget.value))}
              className="replay-scrubber focus-ring relative w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {(mode === 'realtime' ? REALTIME_SPEEDS : EVENT_SPEEDS).map((option) => (
              <button
                key={option}
                onClick={() => setSpeed(option)}
                className={`focus-ring rounded-md px-2 py-1 text-xs tabular-nums transition-colors cursor-pointer ${
                  speed === option
                    ? "bg-accent text-accent-fg"
                    : "text-content-muted hover:bg-surface-hover"
                }`}
              >
                {option}x
              </button>
            ))}
          </div>

          <button
            onClick={exit}
            aria-label="리플레이 종료"
            title="리플레이 종료"
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-content-subtle">
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{formatTime(displayTime)}</span>

            {/* 재생 기준 전환 */}
            <div role="radiogroup" aria-label="재생 기준" className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-hover p-0.5">
              {([
                { value: 'events', label: '픽셀 수', icon: Gauge, hint: '초당 일정한 픽셀 수로 재생합니다.' },
                { value: 'realtime', label: '실제 시간', icon: Clock, hint: '실제로 흐른 시간에 맞춰 재생합니다.' },
              ] as const).map((option) => {
                const Icon = option.icon;
                const isActive = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    title={option.hint}
                    onClick={() => setMode(option.value)}
                    className={`focus-ring flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-accent text-accent-fg' : 'text-content-muted hover:text-content'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* 빈 구간 건너뛰기 -- 실제 시간 모드에서만 의미가 있다 */}
            {mode === 'realtime' && (
              <button
                type="button"
                role="switch"
                aria-checked={skipIdle}
                onClick={() => setSkipIdle(!skipIdle)}
                title="아무도 그리지 않은 시간대를 자동으로 건너뜁니다."
                className={`focus-ring flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors cursor-pointer ${
                  skipIdle
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-border text-content-muted hover:text-content'
                }`}
              >
                <FastForward className="h-3 w-3" />
                빈 구간 건너뛰기
              </button>
            )}

            {lastSkippedMs > 0 && (
              <span className="text-content-muted">{formatDuration(lastSkippedMs)} 건너뜀</span>
            )}
          </div>

          <span className="flex shrink-0 items-center gap-2 tabular-nums">
            {isBuffering && (
              <span className="flex items-center gap-1 text-content-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                불러오는 중
              </span>
            )}
            {playedEvents.toLocaleString()} / {(timeline?.totalEvents ?? 0).toLocaleString()} 픽셀
          </span>
        </div>
      </div>
    </div>
  );
};
