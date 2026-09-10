import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch, FetchMethod } from "../hooks/useFetch";
import { useSocket } from "./Socket.context";

export interface SandboxInfo {
  width: number;
  height: number;
  /** 메인 캔버스 오른쪽 끝에서 샌드박스까지의 빈 간격(px) */
  gap: number;
  resetMinutes: number;
  resetAfter: number;
  maxPixelsPerRequest: number;
}

interface SandboxContextType {
  info: SandboxInfo | null;
  /** 원본 RGB 버퍼 (width*height*3) */
  getBuffer: () => Uint8Array | null;
  /** 버퍼가 통째로 갈릴 때마다 증가 — 렌더러가 전체 재그리기를 판단한다 */
  epoch: number;
  /** 픽셀이 바뀔 때마다 증가 */
  version: number;
  consumeDirtyRegions: () => Array<{ x: number; y: number; width: number; height: number }>;
  /** 다음 초기화까지 남은 초 */
  resetAfter: number;
  reload: () => Promise<void>;
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

/**
 * 샌드박스 캔버스 상태.
 *
 * 메인 캔버스(Pixel.context)와 완전히 분리해 둔다. 버퍼도 좌표계도 따로다.
 * 섞으면 "지워지는 구역"의 픽셀이 영구 캔버스 버퍼에 들어가게 되고,
 * 되돌릴 방법이 없어진다.
 *
 * 청크 스트리밍을 쓰지 않고 REST로 통째로 받는다. 512x512x3 = 768KB 라 한 번에 받아도
 * 부담이 없고, 매시간 통째로 갈리므로 증분 로딩이 의미가 없다.
 */
export const SandboxProvider = ({ children }: PropsWithChildren) => {
  const [info, setInfo] = useState<SandboxInfo | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [version, setVersion] = useState(0);
  const [resetAfter, setResetAfter] = useState(0);

  const bufferRef = useRef<Uint8Array | null>(null);
  const dirtyRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const infoRef = useRef<SandboxInfo | null>(null);

  const { socket } = useSocket();

  const getBuffer = useCallback(() => bufferRef.current, []);

  const consumeDirtyRegions = useCallback(() => {
    const regions = dirtyRef.current;
    dirtyRef.current = [];
    return regions;
  }, []);

  /** 서버에서 캔버스 전체를 다시 받아온다 */
  const reload = useCallback(async () => {
    const base = import.meta.env.VITE_BACKEND_URL ?? '';

    try {
      const response = await fetch(`${base}/sandbox/canvas`);
      if (!response.ok) return;

      const buffer = new Uint8Array(await response.arrayBuffer());
      bufferRef.current = buffer;
      dirtyRef.current = [];
      setEpoch((previous) => previous + 1);
    } catch {
      // 샌드박스를 못 불러와도 메인 캔버스는 정상 동작해야 한다. 조용히 넘어간다.
    }
  }, []);

  // 최초 1회: 크기/간격 등 배치 정보와 캔버스를 받아온다
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await apiFetch(FetchMethod.GET, '/sandbox/info');
      if (cancelled || result.internalStatusCode !== '0000') return;

      const next: SandboxInfo = {
        width: result.data.width,
        height: result.data.height,
        gap: result.data.gap,
        resetMinutes: result.data.resetMinutes,
        resetAfter: result.data.resetAfter,
        maxPixelsPerRequest: result.data.maxPixelsPerRequest,
      };

      infoRef.current = next;
      setInfo(next);
      setResetAfter(next.resetAfter);
      await reload();
    };

    void load();
    return () => { cancelled = true; };
  }, [reload]);

  /*
    남은 시간을 1초씩 깎는다.
    0에 닿으면 서버가 초기화했다는 뜻이므로 캔버스를 다시 받고 카운트다운을 재시작한다.
    (크론과 완벽히 동기화할 수는 없으므로 약간의 여유를 두고 받는다)
  */
  useEffect(() => {
    if (!info) return;

    const timer = setInterval(() => {
      setResetAfter((previous) => {
        if (previous > 1) return previous - 1;

        // 초기화 직후를 받아오도록 조금 기다렸다 갱신한다
        setTimeout(() => {
          void reload();
          void apiFetch(FetchMethod.GET, '/sandbox/info').then((result) => {
            if (result.internalStatusCode === '0000') setResetAfter(result.data.resetAfter);
          });
        }, 1500);

        return info.resetMinutes * 60;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [info, reload]);

  // 실시간 갱신. 메인 캔버스와 다른 이벤트 이름을 쓰므로 서로 섞이지 않는다.
  useEffect(() => {
    if (!socket) return;

    const handler = (data: {
      pixels: Array<{ x: number; y: number; color: { r: number; g: number; b: number } }>;
    }) => {
      const buffer = bufferRef.current;
      const current = infoRef.current;
      if (!buffer || !current) return;

      for (const pixel of data.pixels) {
        if (pixel.x < 0 || pixel.x >= current.width || pixel.y < 0 || pixel.y >= current.height) continue;

        const offset = (pixel.y * current.width + pixel.x) * 3;
        buffer[offset] = pixel.color.r;
        buffer[offset + 1] = pixel.color.g;
        buffer[offset + 2] = pixel.color.b;
        dirtyRef.current.push({ x: pixel.x, y: pixel.y, width: 1, height: 1 });
      }

      setVersion((previous) => previous + 1);
    };

    socket.on('sandbox-pixels-updated', handler);
    return () => { socket.off('sandbox-pixels-updated', handler); };
  }, [socket]);

  const value: SandboxContextType = {
    info,
    getBuffer,
    epoch,
    version,
    consumeDirtyRegions,
    resetAfter,
    reload,
  };

  return (
    <SandboxContext.Provider value={value}>
      {children}
    </SandboxContext.Provider>
  );
};

export const useSandbox = () => {
  const context = useContext(SandboxContext);
  if (context === undefined) {
    throw new Error('useSandbox가 SandboxProvider 외부에서 호출되었습니다.');
  }
  return context;
};
