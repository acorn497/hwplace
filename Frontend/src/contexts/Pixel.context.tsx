import { createContext, useContext, useState, useEffect, useRef, type PropsWithChildren } from "react";
import { PixelLoadStatus } from "./enums/PixelLoadStatus.enum";
import { useSocket } from "./Socket.context";
import { FetchMethod, useFetch } from "../hooks/useFetch";
import { CanvasStatus } from "./enums/CanvasStatus.enum";
import { useCanvas } from "./Canvas.context";
import { useGlobalVariable } from "./GlobalVariable.context";

interface Pixel {
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
  uuid: string;
}

interface PixelContextType {
  pixelLoadStatus: PixelLoadStatus;
  loadedChunk: number;
  totalChunk: number;
  chunkWidth: number;
  chunkHeight: number;
  chunkSize: number;
  pixels: Map<string, Pixel>; // key: "x,y"
  getPixel: (x: number, y: number) => Pixel | undefined;
  setPixel: (x: number, y: number, pixel: Pixel) => void;
}

const PixelContext = createContext<PixelContextType | undefined>(undefined);

export const PixelProvider = ({ children }: PropsWithChildren) => {
  const { socket, isConnected } = useSocket();
  const { setCanvasStatus } = useCanvas();

  const [pixelLoadStatus, setPixelLoadStatus] = useState<PixelLoadStatus>(PixelLoadStatus.INITIALIZING);
  const [loadedChunk, setLoadedChunk] = useState<number>(0);
  const [totalChunk, setTotalChunk] = useState<number>(0);
  const [chunkWidth, setChunkWidth] = useState<number>(0);
  const [chunkHeight, setChunkHeight] = useState<number>(0);
  const [chunkSize, setChunkSize] = useState<number>(0);
  const [pixels, setPixels] = useState<Map<string, Pixel>>(new Map());
  const receivedChunksRef = useRef<Set<number>>(new Set());

  const { setVersion } = useGlobalVariable();

  const { setCanvasSizeX, setCanvasSizeY } = useCanvas();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // 이벤트 리스너 등록
    socket.on('chunk_start', (data) => {
      console.log('Chunk loading started:', data);
      setChunkWidth(data.chunkWidth);
      setChunkHeight(data.chunkHeight);
      setChunkSize(data.chunkSize);
      setTotalChunk(data.chunkWidth * data.chunkHeight);
      setLoadedChunk(0);
      receivedChunksRef.current.clear();
      setPixelLoadStatus(PixelLoadStatus.LOADING);
    });

    socket.on('chunk_data', (data) => {
      console.log(`Received chunk ${data.chunkNumber}(${data.chunkX}, ${data.chunkY}) with ${data.pixels.length} pixels`);

      setPixels((prevPixels) => {
        const newPixels = new Map(prevPixels);
        data.pixels.forEach((pixel: Pixel) => {
          const key = `${pixel.posX},${pixel.posY}`;
          newPixels.set(key, pixel);
        });
        return newPixels;
      });

      // 실제 받은 청크 개수 추적
      receivedChunksRef.current.add(data.chunkNumber);
      setLoadedChunk(receivedChunksRef.current.size);
    });

    socket.on('chunk_finish', () => {
      console.log('Chunk loading finished');
      setPixelLoadStatus(PixelLoadStatus.FINISHED);
      setTimeout(() => {
        // 캔버스 픽셀 렌더링 시작 시그널
        setCanvasStatus(CanvasStatus.DRAWING);
      }, 1250);
    });

    (async () => {
      const result = await useFetch(FetchMethod.GET, '/');
      setVersion(result.data.version);
      setCanvasSizeX(result.data.canvasInfo.sizeX);
      setCanvasSizeY(result.data.canvasInfo.sizeY);
    })();

    // 클린업: 이벤트 리스너 해제
    return () => {
      socket.off('chunk_start');
      socket.off('chunk_data');
      socket.off('chunk_finish');
    };
  }, [socket, isConnected]);

  const getPixel = (x: number, y: number): Pixel | undefined => {
    const key = `${x},${y}`;
    return pixels.get(key);
  };

  // 특정 위치의 픽셀 설정하기
  const setPixel = (x: number, y: number, pixel: Pixel) => {
    setPixels((prevPixels) => {
      const newPixels = new Map(prevPixels);
      const key = `${x},${y}`;
      newPixels.set(key, pixel);
      return newPixels;
    });
  };

  const value: PixelContextType = {
    pixelLoadStatus,
    loadedChunk,
    totalChunk,
    chunkWidth,
    chunkHeight,
    chunkSize,
    pixels,
    getPixel,
    setPixel,
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
