import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useSocket } from "./Socket.context";
import type { Chunk } from "./interfaces/Chunk.interface";
import { CanvasStatus } from "./enums/CanvasStatus.enum";
import type { Pixel, PixelContext } from "./interfaces/Pixel.interface";

const PixelContext = createContext<PixelContext | undefined>(undefined);

export const PixelProvider = ({ children }: PropsWithChildren) => {
  const { socket } = useSocket();
  const [canvasStatus, setCanvasStatus] = useState(CanvasStatus.INITIALIZING);

  // 픽셀 개수
  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);

  // 청크 개수
  const [chunkWidth, setChunkWidth] = useState<number>(0);
  const [chunkHeight, setChunkHeight] = useState<number>(0);
  const [totalChunk, setTotalChunk] = useState<number>(0);
  const [loadedChunk, setLoadedChunk] = useState(0);

  /**
   * 픽셀 데이터
  **/
  const pixels = useRef(new Map<string, Pixel>())

  useEffect(() => {
    socket.on("chunk_start", (data) => {
      setCanvasStatus(CanvasStatus.LOADING);
      setTotalChunk(data.chunkWidth * data.chunkHeight);
      setChunkWidth(data.chunkWidth);
      setChunkHeight(data.chunkHeight);
    });

    socket.on("chunk_data", (data: Chunk) => {
      setLoadedChunk(prev => prev + 1);
      console.log(data)
      data.pixels.forEach((pixel: Pixel) => {

      });
    });

    socket.on("chunk_finish", () => {
      setCanvasStatus(CanvasStatus.FINISHED);
    });

    return () => {
      socket.off("chunk_start");
      socket.off("chunk_data");
      socket.off("chunk_finish");
    };
  }, []);

  const value: PixelContext = {
    canvasStatus, setCanvasStatus,
    canvasWidth, canvasHeight,

    chunkWidth, chunkHeight,
    loadedChunk, totalChunk
  }

  return (
    <PixelContext.Provider value={value}>
      {children}
    </PixelContext.Provider>
  )
}

export const usePixel = () => {
  const context = useContext(PixelContext);
  if (!context) {
    throw new Error("usePixel이 PixelProvider 외부에서 호출되었습니다.");
  }
  return context;
}