import { createContext, useCallback, useContext, useState, useEffect, useRef, type PropsWithChildren } from "react";
import { PixelLoadStatus } from "./enums/PixelLoadStatus.enum";
import { useSocket } from "./Socket.context";
import { FetchMethod, useFetch } from "../hooks/useFetch";
import { CanvasStatus } from "./enums/CanvasStatus.enum";
import { useCanvas } from "./Canvas.context";
import { useGlobalVariable } from "./GlobalVariable.context";
import { PixelPositionContextType } from "./interfaces/PixelPosition.interface";
import { DetailedPixel, DirtyRegion, PixelContextType } from "./interfaces/Pixel.interface";

const BYTES_PER_PIXEL = 3;
/** 미도색 픽셀의 색 (서버 버퍼도 같은 값으로 채워져 온다) */
const BLANK = 255;

const PixelContext = createContext<PixelContextType | undefined>(undefined);

export const PixelProvider = ({ children }: PropsWithChildren) => {
  const { socket } = useSocket();
  const { setCanvasStatus, setCanvasSizeX, setCanvasSizeY } = useCanvas();
  const { setVersion } = useGlobalVariable();

  const [pixelLoadStatus, setPixelLoadStatus] = useState<PixelLoadStatus>(PixelLoadStatus.INITIALIZING);

  const [loadedChunk, setLoadedChunk] = useState<number>(0);
  const [totalChunk, setTotalChunk] = useState<number>(0);
  const [chunkSize, setChunkSize] = useState<number>(0);
  const receivedChunksRef = useRef<Set<number>>(new Set());

  /**
   * 캔버스 전체 RGB 버퍼.
   * 픽셀 하나당 객체 + 문자열 키를 두던 Map을 대체한다. 1024x1024 기준 3MB 한 덩어리이고,
   * 청크가 도착해도 복사 없이 제자리에 기록하므로 GC 부담이 없다.
   */
  const canvasBufferRef = useRef<Uint8Array | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const chunkSizeRef = useRef(0);
  const dirtyRef = useRef<DirtyRegion[]>([]);

  /**
   * 청크를 받는 도중 도착한 실시간 갱신.
   *
   * 청크는 서버가 읽은 시점의 스냅샷이라, 그보다 나중에 칠해진 픽셀이 담겨 있지 않다.
   * 그 픽셀의 청크가 뒤늦게 도착하면 최신 색이 옛 색으로 덮인다.
   * 그래서 로딩 중 갱신은 여기에 따로 남겨두고, 해당 영역의 청크가 도착한 직후 다시 얹는다.
   */
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number; r: number; g: number; b: number }>>(new Map());
  /** 청크 수신 세션이 진행 중인지 (요청 ~ chunk_finish) */
  const isLoadingRef = useRef(false);
  /**
   * 소켓 이펙트 안에서 만들어지는 청크 재요청 함수를 밖으로 노출하기 위한 통로.
   * 리플레이를 빠져나올 때 실시간 캔버스를 다시 받아야 하는데, 청크 요청은
   * 원래 연결 시점에만 일어나므로 이 경로가 필요하다.
   */
  const requestChunksRef = useRef<(() => void) | null>(null);
  /**
   * 리플레이 재생 중인지.
   *
   * 리플레이는 버퍼를 과거 상태로 바꿔놓기 때문에, 이때 도착한 실시간 갱신을 그대로
   * 얹으면 과거 화면에 현재 픽셀이 섞여버린다. 그래서 리플레이 중에는 실시간 반영을 멈춘다.
   * (놓친 갱신은 리플레이를 나갈 때 캔버스를 통째로 다시 받으므로 유실되지 않는다.)
   */
  const replayActiveRef = useRef(false);

  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [pixelVersion, setPixelVersion] = useState(0);

  const [selectedPixels, setSelectedPixels] = useState<PixelPositionContextType[]>([]);
  const [selectedPixel, setSelectedPixel] = useState<DetailedPixel | null>(null);

  const getCanvasBuffer = useCallback(() => canvasBufferRef.current, []);

  const consumeDirtyRegions = useCallback(() => {
    const regions = dirtyRef.current;
    dirtyRef.current = [];
    return regions;
  }, []);

  /**
   * 리플레이가 캔버스 버퍼를 통째로 갈아끼운 뒤 호출한다.
   *
   * 리플레이는 실시간 경로(소켓)를 거치지 않고 버퍼를 직접 쓰므로, 렌더러에게
   * "전체를 다시 그려라"고 알려줄 통로가 따로 필요하다. 전체를 dirty로 표시하고
   * pixelVersion을 올리면 기존 렌더 경로가 그대로 재사용된다.
   */
  const markReplayFrame = useCallback(() => {
    const { width, height } = canvasSizeRef.current;
    if (!canvasBufferRef.current || width <= 0 || height <= 0) return;

    // 매 프레임 영역이 쌓이면 렌더가 느려지므로, 전체 갱신 하나로 합친다
    dirtyRef.current = [{ x: 0, y: 0, width, height }];
    setPixelVersion((prev) => prev + 1);
  }, []);

  /**
   * 실시간 캔버스를 서버에서 다시 받아온다.
   * 리플레이가 버퍼를 과거 상태로 덮어썼기 때문에, 빠져나올 때 현재 상태로 되돌려야 한다.
   */
  const reloadLiveCanvas = useCallback(() => {
    requestChunksRef.current?.();
  }, []);

  /** 리플레이 진입/종료를 알린다. 실시간 갱신 반영 여부를 가른다. */
  const setReplayActive = useCallback((active: boolean) => {
    replayActiveRef.current = active;
  }, []);

  const getPixelColor = useCallback((x: number, y: number) => {
    const buffer = canvasBufferRef.current;
    const { width, height } = canvasSizeRef.current;

    if (!buffer || x < 0 || y < 0 || x >= width || y >= height) {
      return { r: BLANK, g: BLANK, b: BLANK };
    }

    const offset = (y * width + x) * BYTES_PER_PIXEL;
    return { r: buffer[offset], g: buffer[offset + 1], b: buffer[offset + 2] };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const resetLoadState = () => {
      setPixelLoadStatus(PixelLoadStatus.INITIALIZING);
      setLoadedChunk(0);
      setTotalChunk(0);
      receivedChunksRef.current.clear();
      dirtyRef.current = [];
      // 이전 세션에 쌓인 갱신은 서버가 보낼 새 청크에 이미 반영돼 있다. 들고 가면 오히려 옛 값이 된다.
      pendingUpdatesRef.current.clear();
      isLoadingRef.current = true;
    };

    /** 리스너가 준비된 뒤, 연결이 확인되면 청크를 요청한다. */
    const requestChunks = () => {
      resetLoadState();
      console.log('Requesting canvas chunks');
      socket.emit('request-chunks');
    };
    requestChunksRef.current = requestChunks;

    socket.on('chunk_start', (data) => {
      console.log('Chunk loading started:', data);

      if (!data?.canvasWidth || !data?.canvasHeight || !data?.totalChunks) {
        console.error('Invalid chunk loading metadata:', data);
        setPixelLoadStatus(PixelLoadStatus.FAILED);
        return;
      }

      const { canvasWidth, canvasHeight } = data;

      // 캔버스 크기의 단일 출처는 이 이벤트다. HTTP 메타는 버전만 쓴다.
      canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };
      chunkSizeRef.current = data.chunkSize;

      const buffer = new Uint8Array(canvasWidth * canvasHeight * BYTES_PER_PIXEL);
      buffer.fill(BLANK);
      canvasBufferRef.current = buffer;
      dirtyRef.current = [];

      setCanvasSizeX(canvasWidth);
      setCanvasSizeY(canvasHeight);
      setChunkSize(data.chunkSize);
      setTotalChunk(data.totalChunks);
      setLoadedChunk(0);
      receivedChunksRef.current.clear();
      setPixelLoadStatus(PixelLoadStatus.LOADING);
      setCanvasEpoch((prev) => prev + 1);
    });

    socket.on('chunk_data', (data: {
      chunkNumber: number;
      chunkX: number;
      chunkY: number;
      width: number;
      height: number;
      data: ArrayBuffer;
    }) => {
      const buffer = canvasBufferRef.current;
      if (!buffer || !data?.data) return;

      const { width: canvasWidth } = canvasSizeRef.current;
      const chunkBytes = new Uint8Array(data.data);
      const originX = data.chunkX * chunkSizeRef.current;
      const originY = data.chunkY * chunkSizeRef.current;
      const rowBytes = data.width * BYTES_PER_PIXEL;

      // 청크 버퍼는 청크 기준 row-major, 캔버스 버퍼는 캔버스 기준 row-major이므로 행 단위로 옮긴다.
      for (let row = 0; row < data.height; row++) {
        const source = row * rowBytes;
        const destination = ((originY + row) * canvasWidth + originX) * BYTES_PER_PIXEL;
        buffer.set(chunkBytes.subarray(source, source + rowBytes), destination);
      }

      // 이 청크 영역에 더 최신 갱신이 이미 도착해 있었다면 방금 덮어쓴 옛 색 위에 다시 얹는다
      pendingUpdatesRef.current.forEach(({ x, y, r, g, b }) => {
        if (x < originX || y < originY || x >= originX + data.width || y >= originY + data.height) return;

        const offset = (y * canvasWidth + x) * BYTES_PER_PIXEL;
        buffer[offset] = r;
        buffer[offset + 1] = g;
        buffer[offset + 2] = b;
      });

      dirtyRef.current.push({ x: originX, y: originY, width: data.width, height: data.height });

      receivedChunksRef.current.add(data.chunkNumber);
      setLoadedChunk(receivedChunksRef.current.size);
      setPixelVersion((prev) => prev + 1);
      // 첫 청크가 도착한 순간부터 캔버스는 실제로 그려지기 시작한다 (인위적 지연 없음)
      setCanvasStatus(CanvasStatus.DRAWING);
    });

    socket.on('chunk_finish', () => {
      console.log('Chunk loading finished');

      // 청크가 끝내 도착하지 않은 영역의 갱신까지 여기서 마무리한다
      const buffer = canvasBufferRef.current;
      if (buffer && pendingUpdatesRef.current.size > 0) {
        const { width, height } = canvasSizeRef.current;

        pendingUpdatesRef.current.forEach(({ x, y, r, g, b }) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return;

          const offset = (y * width + x) * BYTES_PER_PIXEL;
          buffer[offset] = r;
          buffer[offset + 1] = g;
          buffer[offset + 2] = b;
          dirtyRef.current.push({ x, y, width: 1, height: 1 });
        });

        setPixelVersion((prev) => prev + 1);
      }

      pendingUpdatesRef.current.clear();
      isLoadingRef.current = false;
      setPixelLoadStatus(PixelLoadStatus.FINISHED);
    });

    socket.on('chunk_error', (data: { message?: string }) => {
      console.error('Chunk loading failed:', data?.message);
      pendingUpdatesRef.current.clear();
      isLoadingRef.current = false;
      setPixelLoadStatus(PixelLoadStatus.FAILED);
    });

    socket.on('batch-pixels-updated', (data: { pixels: Array<{ x: number, y: number, color: { r: number, g: number, b: number } }> }) => {
      console.log(`Received batch update: ${data.pixels.length} pixels`);

      // 리플레이 중에는 화면이 과거 시점이므로 실시간 갱신을 얹지 않는다.
      // 나갈 때 전체 캔버스를 다시 받으니 여기서 버려도 최신 상태를 잃지 않는다.
      if (replayActiveRef.current) return;

      const buffer = canvasBufferRef.current;
      const { width, height } = canvasSizeRef.current;

      data.pixels.forEach(({ x, y, color }) => {
        // 로딩 중 갱신은 뒤늦게 오는 청크에 덮이지 않도록 따로 남겨둔다.
        // 아직 버퍼가 없는 시점(chunk_start 이전)에 온 갱신도 여기에 모여 유실되지 않는다.
        if (isLoadingRef.current) {
          pendingUpdatesRef.current.set(`${x},${y}`, { x, y, r: color.r, g: color.g, b: color.b });
        }

        if (!buffer || x < 0 || y < 0 || x >= width || y >= height) return;

        const offset = (y * width + x) * BYTES_PER_PIXEL;
        buffer[offset] = color.r;
        buffer[offset + 1] = color.g;
        buffer[offset + 2] = color.b;

        dirtyRef.current.push({ x, y, width: 1, height: 1 });
      });

      if (buffer) setPixelVersion((prev) => prev + 1);
    });

    // 연결 성공 직후(또는 이미 연결된 경우) 픽셀 데이터 요청
    socket.on('connect', requestChunks);
    if (socket.connected) {
      requestChunks();
    } else {
      socket.connect();
    }

    (async () => {
      try {
        const result = await useFetch(FetchMethod.GET, '/');
        // 캔버스 크기는 chunk_start가 준다. 여기서 또 세팅하면 두 출처가 어긋날 수 있다.
        if (result?.data?.version) setVersion(result.data.version);
      } catch (error) {
        console.error('Failed to fetch canvas info:', error);
      }
    })();

    return () => {
      socket.off('connect', requestChunks);
      socket.off('chunk_start');
      socket.off('chunk_data');
      socket.off('chunk_finish');
      socket.off('chunk_error');
      socket.off('batch-pixels-updated');
      requestChunksRef.current = null;
    };
  }, [socket, setCanvasStatus, setVersion, setCanvasSizeX, setCanvasSizeY]);

  const value: PixelContextType = {
    pixelLoadStatus,
    loadedChunk,
    totalChunk,
    chunkSize,
    getCanvasBuffer,
    canvasEpoch,
    pixelVersion,
    consumeDirtyRegions,
    markReplayFrame,
    reloadLiveCanvas,
    setReplayActive,
    getPixelColor,
    selectedPixels, setSelectedPixels,
    selectedPixel, setSelectedPixel,
  };

  return (
    <PixelContext.Provider value={value}>
      {children}
    </PixelContext.Provider>
  );
};

export const usePixel = () => {
  const context = useContext(PixelContext);
  if (context === undefined) {
    throw new Error('usePixel이 PixelProvider 외부에서 호출되었습니다.');
  }
  return context;
};
