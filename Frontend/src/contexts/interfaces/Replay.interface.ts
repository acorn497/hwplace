/** 리플레이가 다룰 수 있는 전체 기간과 탐색용 키프레임 목록 */
export interface ReplayTimeline {
  start: Date;
  end: Date;
  totalEvents: number;
  lastEventIdx: number;
  canvasWidth: number;
  canvasHeight: number;
  /** 이 시점들로는 서버가 싸게 점프할 수 있다 */
  keyframes: Array<{ version: number; at: Date }>;
}

/** 재생 중 얹어지는 픽셀 변경 하나 */
export interface ReplayEvent {
  idx: number;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  at: string;
  userId: number | null;
}

/**
 * 재생 기준.
 * - 'events'    : 초당 N픽셀. 한산한 구간도 촘촘한 구간도 같은 속도로 그려진다.
 * - 'realtime'  : 실제 흐른 시간 기준. 실제로 그려진 리듬이 그대로 재현되지만,
 *                 아무도 그리지 않은 빈 구간에서는 화면이 멈춘다 -> skipIdle로 건너뛴다.
 */
export type ReplayMode = 'events' | 'realtime';

/** 활동량이 있는 한 구간 (실시간 모드의 타임라인 표시 / 빈 구간 건너뛰기에 쓰인다) */
export interface ActivitySegment {
  /** 구간 시작/끝 (에폭 ms) */
  start: number;
  end: number;
  /** 이 구간에서 일어난 이벤트 수 */
  count: number;
  /** 구간 내 최대치 대비 밀도 0~1 (타임라인 색 농도) */
  intensity: number;
}

/** 타임라인 전체의 활동 분포 */
export interface ActivityMap {
  /** 한 칸의 길이 (ms) */
  bucketMs: number;
  segments: ActivitySegment[];
  /** 이벤트가 없어 건너뛸 수 있는 구간들 */
  gaps: Array<{ start: number; end: number }>;
}

export type ReplayStatus =
  /** 리플레이 모드가 꺼져 있음 (실시간 캔버스) */
  | 'idle'
  /** 타임라인/시작 상태를 불러오는 중 */
  | 'loading'
  /** 준비됐지만 멈춰 있음 */
  | 'paused'
  /** 재생 중 */
  | 'playing'
  | 'error';

export interface ReplayContextType {
  status: ReplayStatus;
  timeline: ReplayTimeline | null;
  error: string | null;

  /** 리플레이 모드 진입/종료 */
  enter: () => Promise<void>;
  exit: () => void;
  isActive: boolean;

  /** 현재 재생 위치 (에폭 밀리초) */
  currentTime: number;
  /** 이 시점으로 점프한다 */
  seek: (time: number) => void;

  play: () => void;
  pause: () => void;

  /** 배속 (1 = 실시간 대비 기준 속도) */
  speed: number;
  setSpeed: (speed: number) => void;

  /** 재생 기준 (초당 픽셀 수 / 실제 시간 흐름) */
  mode: ReplayMode;
  setMode: (mode: ReplayMode) => void;

  /** 실시간 모드에서 비어 있는 구간을 자동으로 건너뛸지 */
  skipIdle: boolean;
  setSkipIdle: (skip: boolean) => void;

  /** 활동 분포 (타임라인 히트맵 + 건너뛰기 판단) */
  activity: ActivityMap | null;
  /** 방금 빈 구간을 건너뛰었다면 그 길이(ms). UI 표시용이며 잠시 후 0으로 돌아간다 */
  lastSkippedMs: number;

  /** 지금까지 재생한 이벤트 수 / 전체 */
  playedEvents: number;
  /** 버퍼링 중인지 (다음 이벤트 묶음을 기다림) */
  isBuffering: boolean;
}
