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

  /**
   * 캔버스를 실제로 클릭한 순간을 알리는 신호.
   * 스포이드/페인트통처럼 "무장 후 캔버스 클릭"으로 동작하는 도구는 전역 mousedown이 아니라
   * 이 신호를 봐야 한다. (툴바 버튼을 누르는 클릭까지 삼켜 오발동하던 문제를 막는다)
   * seq는 같은 칸을 연속으로 클릭해도 값이 달라지도록 하는 단조 증가 카운터다.
   */
  canvasClick: { x: number; y: number; seq: number } | null;
  notifyCanvasClick: (position: PixelPositionContextType) => void;

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