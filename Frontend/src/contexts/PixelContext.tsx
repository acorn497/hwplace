import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useSocket } from "./SocketContext";

const PixelContext = createContext<PixelInterface | undefined>(undefined);

export enum CanvasStatusEnum {
  INITIALIZING = "캔버스 초기화 중...",
  LOADING = "청크 데이터 불러오는 중...",
  FINISHED = "로드 완료됨!",
}

interface PixelInterface {
  canvasStatus: CanvasStatusEnum,
  setCanvasStatus: (parameter: CanvasStatusEnum) => void,

  canvasWidth: number,
  canvasHeight: number,

  chunkWidth: number,
  chunkHeight: number,
  totalChunk: number,
  loadedChunk: number,

}

export const PixelProvider = ({ children }: PropsWithChildren) => {
  const { socket } = useSocket();
  const [canvasStatus, setCanvasStatus] = useState(CanvasStatusEnum.INITIALIZING);

  // 픽셀 개수
  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);

  // 청크 개수
  const [chunkWidth, setChunkWidth] = useState<number>(0);
  const [chunkHeight, setChunkHeight] = useState<number>(0);
  const [totalChunk, setTotalChunk] = useState<number>(0);
  const [loadedChunk, setLoadedChunk] = useState(0);

  const { connectionStatus } = useSocket();

  useEffect(() => {
    // if (!(connectionStatus === ConnectionStatusEnum.ESTABLISHED)) return;

    socket.on("chunk_start", (data) => {
      setCanvasStatus(CanvasStatusEnum.LOADING);
      setTotalChunk(data.chunkSize)
      setChunkWidth(data.chunkWidth);
      setChunkHeight(data.chunkHeight);
    });

    socket.on("chunk_data", (data) => {
      setLoadedChunk((data.chunkX + 1) * (data.chunkY + 1));
      console.log(data)
    });


    socket.on("chunk_finish", () => {
      setCanvasStatus(CanvasStatusEnum.FINISHED);
    });

    return () => {
      socket.off("chunk_start");
      socket.off("chunk_data");
      socket.off("chunk_finish");
    };
  }, [connectionStatus]);

  const value = {
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