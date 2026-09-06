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

  /** 연속 줌 모델의 최소/최대 배율. 줌 관련 UI/로직은 항상 이 범위로 clamp 해야 한다. */
  minZoom: number;
  maxZoom: number;

  /** 캔버스를 손(스페이스+드래그, 휠 가운데 버튼 드래그)으로 이동 중인지 여부 */
  isPanning: boolean;
  setIsPanning: (isPanning: boolean) => void;

  /**
   * "화면에 맞추기"를 요청하기 위한 신호 카운터.
   * 실제 계산(뷰포트/컨테이너 크기 기반)은 컨테이너 ref를 들고 있는 PixelField가 수행하므로,
   * 다른 컴포넌트는 requestFitToScreen()만 호출하면 된다.
   */
  fitToScreenSignal: number;
  requestFitToScreen: () => void;
}