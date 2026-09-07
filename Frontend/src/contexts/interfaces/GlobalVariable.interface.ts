import { PanelPosition } from "../enums/PanelPosition.enum";
import { Tool } from "../enums/Tool.enum";
import { View } from "../enums/View.enum";

export interface GlobalVariableContextType {
  currentView: View;
  setCurrentView: (view: View) => void;

  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;


  ping: number;
  setPing: (ping: number) => void;

  totalBatchedPixelCount: number;
  setTotalBatchedPixelCount: (ping: number) => void;

  version: string;
  setVersion: (version: string) => void;

  /** 캔버스에 픽셀 경계선(그리드)을 표시할지 */
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;

  panelPosition: PanelPosition;
  setPanelPosition: (position: PanelPosition) => void;
}