import { CanvasStatus } from "../enums/CanvasStatus.enum";
import { DragMode } from "../enums/DragMode.enum";
import { PixelPositionContextType } from "./PixelPosition.interface";

export interface CanvasContextType {
  canvasStatus: CanvasStatus;
  setCanvasStatus: (status: CanvasStatus) => void;

  canvasSizeX: number;
  setCanvasSizeX: (sizeX: number) => void;

  canvasSizeY: number;
  setCanvasSizeY: (sizeY: number) => void;

  loadedPixel: number;
  setLoadedPixel: (count: number) => void;

  zoom: number;
  setZoom: (zoom: number) => void;

  cursorPosition: PixelPositionContextType;
  setCursorPosition: (position: PixelPositionContextType) => void;

  dragMode: DragMode;
  setDragMode: (mode: DragMode) => void;

  isLeftDown: boolean;
  setIsLeftDown: (isDown: boolean) => void;
  
  isCloneColorActive: boolean;
  setIsCloneColorActive: (isDown: boolean) => void;
  
  isPaintBucketActive: boolean;
  setIsPaintBucketActive: (isDown: boolean) => void;
}