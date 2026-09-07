import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type PropsWithChildren,
} from "react";
import axios from "axios";
import { usePixel } from "./Pixel.context";
import { useCanvas } from "./Canvas.context";
import type {
  ActivityMap, ReplayContextType, ReplayEvent, ReplayMode, ReplayStatus, ReplayTimeline,
} from "./interfaces/Replay.interface";

const ReplayContext = createContext<ReplayContextType | undefined>(undefined);

const api = axios.create({ baseURL: import.meta.env.VITE_BACKEND_URL });

/** 한 번에 미리 받아두는 이벤트 수 */
const FETCH_SIZE = 5_000;
/** 남은 버퍼가 이보다 적어지면 다음 묶음을 당겨온다 */
const PREFETCH_THRESHOLD = 1_000;
/** 'events' 모드에서 배속 1일 때 초당 재생할 이벤트 수 */
const EVENTS_PER_SECOND = 200;

/**
 * 'realtime' 모드에서 배속 1이 의미하는 "실제 시간" 배율.
 * 1배속이 진짜 1초=1초이면 하루치를 보는 데 하루가 걸리므로,
 * 기본 배율을 크게 잡고 배속 버튼으로 더 키운다.
 */
const REALTIME_BASE_SCALE = 60;

/** 한 프레임에 적용할 이벤트 수 상한 (한 번에 너무 많이 그려 프레임이 끊기는 것 방지) */
const MAX_EVENTS_PER_FRAME = 20_000;

/** 이보다 긴 무활동 구간은 '건너뛸 수 있는 빈 구간'으로 본다 */
const IDLE_GAP_MS = 30_000;

/** 활동 히스토그램 버킷 수 (타임라인 가로 픽셀 수와 비슷하게) */
const ACTIVITY_BUCKETS = 240;

/** 서버 히스토그램을 화면용 구간 목록으로 바꾼다 */
const buildActivityMap = (data: {
  start: number; bucketMs: number; counts: number[];
}): ActivityMap => {
  const { start, bucketMs, counts } = data;
  const max = counts.reduce((acc, value) => (value > acc ? value : acc), 0);

  const segments = counts.map((count, index) => ({
    start: start + index * bucketMs,
    end: start + (index + 1) * bucketMs,
    count,
    // 활동량 편차가 커서 선형으로는 대부분이 안 보인다. 로그로 눌러 약한 활동도 드러나게 한다.
    intensity: count > 0 && max > 0 ? Math.log1p(count) / Math.log1p(max) : 0,
  }));

  // 빈 버킷이 연속으로 이어지는 구간을 하나의 gap 으로 합친다
  const gaps: Array<{ start: number; end: number }> = [];
  let runStart: number | null = null;
  for (let i = 0; i <= segments.length; i++) {
    const empty = i < segments.length && segments[i].count === 0;
    if (empty && runStart === null) runStart = segments[i].start;
    if (!empty && runStart !== null) {
      const runEnd = segments[i - 1].end;
      if (runEnd - runStart >= IDLE_GAP_MS) gaps.push({ start: runStart, end: runEnd });
      runStart = null;
    }
  }

  return { bucketMs, segments, gaps };
};

export const ReplayProvider = ({ children }: PropsWithChildren) => {
  const { getCanvasBuffer, markReplayFrame, reloadLiveCanvas, setReplayActive } = usePixel();
  const { canvasSizeX, canvasSizeY } = useCanvas();

  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playedEvents, setPlayedEvents] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [mode, setMode] = useState<ReplayMode>('events');
  const [skipIdle, setSkipIdle] = useState(true);
  const [activity, setActivity] = useState<ActivityMap | null>(null);
  const [lastSkippedMs, setLastSkippedMs] = useState(0);

  /** 아직 재생하지 않은 이벤트 큐 */
  const queueRef = useRef<ReplayEvent[]>([]);
  /** 큐에서 다음에 꺼낼 위치 (shift는 O(n)이라 인덱스로 소비한다) */
  const queueHeadRef = useRef(0);
  /** 서버에서 다음에 이어받을 커서 */
  const cursorRef = useRef<number | null>(null);
  const hasMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  /** seek이 겹칠 때 오래된 응답이 최신 상태를 덮지 않도록 하는 세대 번호 */
  const generationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const statusRef = useRef<ReplayStatus>('idle');
  const speedRef = useRef(1);
  const modeRef = useRef<ReplayMode>('events');
  const skipIdleRef = useRef(true);
  const activityRef = useRef<ActivityMap | null>(null);
  /** 실시간 모드에서 '지금 재생 중인 가상 시각' (에폭 ms) */
  const virtualTimeRef = useRef(0);
  /** 건너뛰기 안내를 잠시 후 지우는 타이머 */
  const skipNoticeRef = useRef<number | null>(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  /*
    모드를 바꾸면 시계 기준을 다시 잡는다.
    'events'로 재생하는 동안 가상 시계는 멈춰 있으므로, 그대로 'realtime'으로 넘어가면
    한참 전 시각부터 다시 흐르며 이미 지나온 구간을 되짚는다.
    전환 시점의 실제 재생 위치(currentTime)를 가상 시계에 심어 이어지게 한다.
  */
  useEffect(() => {
    modeRef.current = mode;
    virtualTimeRef.current = currentTime;
    lastTickRef.current = performance.now();
    // 모드가 바뀌면 이전 모드에서의 건너뛰기 안내는 의미가 없다
    setLastSkippedMs(0);
    // currentTime은 매 프레임 바뀌므로 의존성에 넣지 않는다 (mode 전환 시점의 값만 필요)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { skipIdleRef.current = skipIdle; }, [skipIdle]);
  useEffect(() => { activityRef.current = activity; }, [activity]);
  useEffect(() => () => {
    if (skipNoticeRef.current !== null) clearTimeout(skipNoticeRef.current);
  }, []);

  /** 건너뛴 사실을 잠깐 보여준다 */
  const noticeSkip = useCallback((ms: number) => {
    setLastSkippedMs(ms);
    if (skipNoticeRef.current !== null) clearTimeout(skipNoticeRef.current);
    skipNoticeRef.current = window.setTimeout(() => setLastSkippedMs(0), 2_500);
  }, []);

  /** 특정 시점의 캔버스를 받아 현재 버퍼에 그대로 눌러 담는다 */
  const loadCanvasAt = useCallback(async (at: Date, generation: number) => {
    const response = await api.get('/replay/canvas', {
      params: { at: at.toISOString() },
      responseType: 'arraybuffer',
    });

    // 그 사이 다른 seek이나 종료가 있었으면 버린다
    if (generation !== generationRef.current) return false;

    const buffer = getCanvasBuffer();
    if (!buffer) return false;

    const incoming = new Uint8Array(response.data);
    // 서버 캔버스 크기와 로컬 버퍼가 어긋나면 덮어쓰지 않는다 (깨진 화면 방지)
    if (incoming.length !== buffer.length) {
      throw new Error('서버 캔버스 크기가 현재 화면과 다릅니다.');
    }

    buffer.set(incoming);
    markReplayFrame();
    return true;
  }, [getCanvasBuffer, markReplayFrame]);

  /** 다음 이벤트 묶음을 받아 큐에 잇는다 */
  const fetchMore = useCallback(async (generation: number) => {
    if (fetchingRef.current || !hasMoreRef.current) return;

    fetchingRef.current = true;
    try {
      const response = await api.get('/replay/events', {
        params: { after: cursorRef.current ?? undefined, limit: FETCH_SIZE },
      });

      if (generation !== generationRef.current) return;

      const { events, nextCursor, hasMore } = response.data as {
        events: ReplayEvent[]; nextCursor: number | null; hasMore: boolean;
      };

      // 이미 소비한 앞부분을 잘라내 큐가 무한히 자라지 않게 한다
      if (queueHeadRef.current > 0) {
        queueRef.current = queueRef.current.slice(queueHeadRef.current);
        queueHeadRef.current = 0;
      }
      queueRef.current.push(...events);
      cursorRef.current = nextCursor;
      hasMoreRef.current = hasMore;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  /** 큐에서 n개를 꺼내 버퍼에 얹는다 */
  const applyEvents = useCallback((count: number) => {
    const buffer = getCanvasBuffer();
    if (!buffer) return 0;

    const queue = queueRef.current;
    let applied = 0;
    let lastAt = 0;

    while (applied < count && queueHeadRef.current < queue.length) {
      const event = queue[queueHeadRef.current++];
      if (event.x >= 0 && event.y >= 0 && event.x < canvasSizeX && event.y < canvasSizeY) {
        const offset = (event.y * canvasSizeX + event.x) * 3;
        buffer[offset] = event.r;
        buffer[offset + 1] = event.g;
        buffer[offset + 2] = event.b;
      }
      lastAt = new Date(event.at).getTime();
      applied++;
    }

    if (applied > 0) {
      markReplayFrame();
      setPlayedEvents(prev => prev + applied);
      if (lastAt) setCurrentTime(lastAt);
    }
    return applied;
  }, [getCanvasBuffer, markReplayFrame, canvasSizeX, canvasSizeY]);

  /**
   * 'realtime' 모드용. 가상 시각(untilAt)까지 일어난 이벤트를 모두 얹는다.
   * 이벤트 수가 아니라 "시각"이 기준이므로 붐비는 구간은 한 프레임에 많이,
   * 한산한 구간은 거의 없이 그려진다 -- 실제로 그려지던 리듬이 그대로 재현된다.
   */
  const applyEventsUntil = useCallback((untilAt: number) => {
    const buffer = getCanvasBuffer();
    if (!buffer) return 0;

    const queue = queueRef.current;
    let applied = 0;

    while (queueHeadRef.current < queue.length && applied < MAX_EVENTS_PER_FRAME) {
      const event = queue[queueHeadRef.current];
      if (new Date(event.at).getTime() > untilAt) break;

      queueHeadRef.current++;
      if (event.x >= 0 && event.y >= 0 && event.x < canvasSizeX && event.y < canvasSizeY) {
        const offset = (event.y * canvasSizeX + event.x) * 3;
        buffer[offset] = event.r;
        buffer[offset + 1] = event.g;
        buffer[offset + 2] = event.b;
      }
      applied++;
    }

    if (applied > 0) {
      markReplayFrame();
      setPlayedEvents(prev => prev + applied);
    }
    return applied;
  }, [getCanvasBuffer, markReplayFrame, canvasSizeX, canvasSizeY]);

  /**
   * 지금 시각이 '건너뛸 수 있는 빈 구간' 안이라면 그 끝 시각을 돌려준다.
   * 큐에 다음 이벤트가 남아 있으면 그 시각까지만 건너뛰어, 아직 못 받은 구간을 넘겨버리지 않는다.
   */
  const findSkipTarget = useCallback((at: number) => {
    if (!skipIdleRef.current) return null;
    const map = activityRef.current;
    if (!map) return null;

    const gap = map.gaps.find(g => at >= g.start && at < g.end - 1);
    if (!gap) return null;

    const queue = queueRef.current;
    const next = queue[queueHeadRef.current];
    // 다음 이벤트가 gap 안에 있다면(=집계 버킷과 실제 데이터가 어긋난 경우) 그 이벤트를 건너뛰지 않는다
    if (next) {
      const nextAt = new Date(next.at).getTime();
      if (nextAt < gap.end) return nextAt > at ? nextAt : null;
    }
    return gap.end;
  }, []);

  /** 재생 루프 */
  useEffect(() => {
    if (status !== 'playing') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastTickRef.current = performance.now();
    const generation = generationRef.current;

    const tick = (now: number) => {
      if (generation !== generationRef.current) return;

      const elapsed = (now - lastTickRef.current) / 1000;
      const remainingBefore = queueRef.current.length - queueHeadRef.current;
      if (remainingBefore < PREFETCH_THRESHOLD) void fetchMore(generation);

      if (modeRef.current === 'realtime') {
        /*
          실제 시간 기준. 가상 시계를 흘려보내고, 그 시각까지의 이벤트를 얹는다.
          아무 일도 없던 구간에서는 화면이 멈추므로, 빈 구간이면 시계를 끝으로 점프시킨다.
        */
        lastTickRef.current = now;
        virtualTimeRef.current += elapsed * 1000 * REALTIME_BASE_SCALE * speedRef.current;

        const skipTo = findSkipTarget(virtualTimeRef.current);
        if (skipTo !== null && skipTo > virtualTimeRef.current) {
          noticeSkip(skipTo - virtualTimeRef.current);
          virtualTimeRef.current = skipTo;
        }

        const applied = applyEventsUntil(virtualTimeRef.current);
        setCurrentTime(virtualTimeRef.current);

        const remaining = queueRef.current.length - queueHeadRef.current;
        if (remaining === 0 && !hasMoreRef.current) {
          setStatus('paused');
          setIsBuffering(false);
          return;
        }
        // 다음 이벤트가 아직 안 왔는데 가상 시계가 그 시각을 넘어섰다면 기다린다
        setIsBuffering(applied === 0 && remaining === 0);
      } else {
        // 초당 픽셀 수 기준 (기존 동작)
        const budget = Math.floor(elapsed * EVENTS_PER_SECOND * speedRef.current);
        if (budget > 0) {
          lastTickRef.current = now;
          const applied = applyEvents(budget);
          const remaining = queueRef.current.length - queueHeadRef.current;

          if (applied === 0) {
            if (!hasMoreRef.current && remaining === 0) {
              // 끝까지 재생했다
              setStatus('paused');
              setIsBuffering(false);
              return;
            }
            setIsBuffering(true);
          } else {
            setIsBuffering(false);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [status, applyEvents, applyEventsUntil, fetchMore, findSkipTarget, noticeSkip]);

  const seek = useCallback((time: number) => {
    if (!timeline) return;

    const generation = ++generationRef.current;
    const target = new Date(Math.min(Math.max(time, timeline.start.getTime()), timeline.end.getTime()));

    queueRef.current = [];
    queueHeadRef.current = 0;
    cursorRef.current = null;
    hasMoreRef.current = true;
    setCurrentTime(target.getTime());
    // 실시간 모드의 가상 시계도 함께 옮겨야 한다 (안 그러면 예전 시각부터 다시 흐른다)
    virtualTimeRef.current = target.getTime();
    setIsBuffering(true);

    void (async () => {
      try {
        // 해당 시점의 캔버스를 받고, 그 이후 이벤트부터 이어받는다
        const ok = await loadCanvasAt(target, generation);
        if (!ok || generation !== generationRef.current) return;

        const response = await api.get('/replay/events', {
          params: { from: target.toISOString(), limit: FETCH_SIZE },
        });
        if (generation !== generationRef.current) return;

        const { events, nextCursor, hasMore } = response.data;
        queueRef.current = events;
        queueHeadRef.current = 0;
        cursorRef.current = nextCursor;
        hasMoreRef.current = hasMore;
        setIsBuffering(false);
      } catch (err) {
        if (generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : '리플레이 탐색에 실패했습니다.');
        setStatus('error');
      }
    })();
  }, [timeline, loadCanvasAt]);

  const enter = useCallback(async () => {
    setStatus('loading');
    setError(null);
    // 이 시점부터 실시간 갱신은 버퍼에 반영되지 않는다
    setReplayActive(true);

    try {
      const response = await api.get('/replay/timeline');

      if (!response.data?.available) {
        setError(response.data?.message ?? '리플레이할 기록이 없습니다.');
        setStatus('error');
        return;
      }

      const loaded: ReplayTimeline = {
        ...response.data,
        start: new Date(response.data.start),
        end: new Date(response.data.end),
        keyframes: (response.data.keyframes ?? []).map((k: { version: number; at: string }) => ({
          version: k.version, at: new Date(k.at),
        })),
      };

      setTimeline(loaded);
      setPlayedEvents(0);

      // 처음에는 맨 앞으로 간다
      const generation = ++generationRef.current;
      queueRef.current = [];
      queueHeadRef.current = 0;
      cursorRef.current = null;
      hasMoreRef.current = true;
      setCurrentTime(loaded.start.getTime());
      virtualTimeRef.current = loaded.start.getTime();

      // 활동 분포는 실패해도 재생 자체는 가능해야 하므로 조용히 넘어간다
      void api.get('/replay/activity', { params: { buckets: ACTIVITY_BUCKETS } })
        .then(res => {
          if (generation !== generationRef.current) return;
          if (!res.data?.available) return;
          setActivity(buildActivityMap(res.data));
        })
        .catch(() => { /* 히트맵 없이 진행 */ });

      await loadCanvasAt(loaded.start, generation);
      if (generation !== generationRef.current) return;

      const events = await api.get('/replay/events', {
        params: { from: loaded.start.toISOString(), limit: FETCH_SIZE },
      });
      if (generation !== generationRef.current) return;

      queueRef.current = events.data.events;
      cursorRef.current = events.data.nextCursor;
      hasMoreRef.current = events.data.hasMore;

      setStatus('paused');
      setIsBuffering(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '리플레이를 불러오지 못했습니다.');
      setStatus('error');
    }
  }, [loadCanvasAt, setReplayActive]);

  const exit = useCallback(() => {
    // 진행 중인 요청과 재생 루프를 모두 무효화한다
    generationRef.current++;
    queueRef.current = [];
    queueHeadRef.current = 0;
    cursorRef.current = null;
    hasMoreRef.current = false;
    setStatus('idle');
    setTimeline(null);
    setError(null);
    setPlayedEvents(0);
    setIsBuffering(false);
    setActivity(null);
    setLastSkippedMs(0);
    virtualTimeRef.current = 0;

    // 실시간 반영을 되살리고, 과거 상태로 덮인 버퍼를 현재 캔버스로 다시 받는다
    setReplayActive(false);
    reloadLiveCanvas();
  }, [reloadLiveCanvas, setReplayActive]);

  const play = useCallback(() => {
    // 멈춰 있던 동안 실제 시간이 흘렀어도 가상 시계는 그대로여야 하므로 기준점을 다시 잡는다
    lastTickRef.current = performance.now();
    setStatus(prev => (prev === 'paused' ? 'playing' : prev));
  }, []);

  const pause = useCallback(() => {
    setStatus(prev => (prev === 'playing' ? 'paused' : prev));
  }, []);

  return (
    <ReplayContext.Provider value={{
      status, timeline, error,
      enter, exit,
      isActive: status !== 'idle',
      currentTime, seek,
      play, pause,
      speed, setSpeed,
      mode, setMode,
      skipIdle, setSkipIdle,
      activity, lastSkippedMs,
      playedEvents, isBuffering,
    }}>
      {children}
    </ReplayContext.Provider>
  );
};

export const useReplay = () => {
  const context = useContext(ReplayContext);
  if (!context) throw new Error('useReplay must be used within a ReplayProvider');
  return context;
};
