import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { CanvasStatus } from "./enums/CanvasStatus.enum";

interface CanvasContextType {
  canvasStatus: CanvasStatus;
  setCanvasStatus: (status: CanvasStatus) => void;

  canvasSizeX: number;
  setCanvasSizeX: (sizeX: number) => void;

  canvasSizeY: number;
  setCanvasSizeY: (sizeY: number) => void;

  loadedPixel: number;
  setLoadedPixel: (count: number) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider = ({ children }: PropsWithChildren) => {
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>(CanvasStatus.WAITING);

  const [canvasSizeX, setCanvasSizeX] = useState(0);
  const [canvasSizeY, setCanvasSizeY] = useState(0);  
  const [loadedPixel, setLoadedPixel] = useState(0);

  const value: CanvasContextType = {
    canvasStatus, setCanvasStatus,
    canvasSizeX, setCanvasSizeX,
    canvasSizeY, setCanvasSizeY,
    loadedPixel, setLoadedPixel,
  };

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas가 PixelProvider 외부에서 호출되었습니다.');
  }
  return context;
};
