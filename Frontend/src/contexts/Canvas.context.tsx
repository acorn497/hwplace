import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { CanvasStatus } from "./enums/CanvasStatus.enum";
import { DragMode } from "./enums/DragMode.enum";
import { CanvasContextType } from "./interfaces/Canvas.interface";

/** 연속 줌 모델의 최소/최대 배율 */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider = ({ children }: PropsWithChildren) => {
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>(CanvasStatus.WAITING);

  const [canvasSizeX, setCanvasSizeX] = useState(0);
  const [canvasSizeY, setCanvasSizeY] = useState(0);

  const [zoom, setZoomState] = useState(1);
  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
  }, []);

  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(DragMode.NONE);
  const [isLeftDown, setIsLeftDown] = useState(false);
  const [isCloneColorActive, setIsCloneColorActive] = useState(false);
  const [isPaintBucketActive, setIsPaintBucketActive] = useState(false);

  const [isPanning, setIsPanning] = useState(false);
  const [fitToScreenSignal, setFitToScreenSignal] = useState(0);
  const requestFitToScreen = useCallback(() => {
    setFitToScreenSignal((prev) => prev + 1);
  }, []);

  const value: CanvasContextType = {
    canvasStatus, setCanvasStatus,
    canvasSizeX, setCanvasSizeX,
    canvasSizeY, setCanvasSizeY,

    zoom, setZoom,
    cursorPosition, setCursorPosition,
    dragMode, setDragMode,
    isLeftDown, setIsLeftDown,
    isCloneColorActive, setIsCloneColorActive,
    isPaintBucketActive, setIsPaintBucketActive,

    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    isPanning, setIsPanning,
    fitToScreenSignal, requestFitToScreen,
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
