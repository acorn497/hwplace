import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { CanvasStatus } from "./enums/CanvasStatus.enum";
import { DragMode } from "./enums/DragMode.enum";
import { CanvasContextType } from "./interfaces/Canvas.interface";

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider = ({ children }: PropsWithChildren) => {
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>(CanvasStatus.WAITING);

  const [canvasSizeX, setCanvasSizeX] = useState(0);
  const [canvasSizeY, setCanvasSizeY] = useState(0);
  const [loadedPixel, setLoadedPixel] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(DragMode.NONE);
  const [isLeftDown, setIsLeftDown] = useState(false);
  const [isCloneColorActive, setIsCloneColorActive] = useState(false);
  const [isPaintBucketActive, setIsPaintBucketActive] = useState(false);

  const value: CanvasContextType = {
    canvasStatus, setCanvasStatus,
    canvasSizeX, setCanvasSizeX,
    canvasSizeY, setCanvasSizeY,
    loadedPixel, setLoadedPixel,

    zoom, setZoom,
    cursorPosition, setCursorPosition,
    dragMode, setDragMode,
    isLeftDown, setIsLeftDown,
    isCloneColorActive, setIsCloneColorActive,
    isPaintBucketActive, setIsPaintBucketActive
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
