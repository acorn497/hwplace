import { Tool } from "../enums/Tool.enum";
import { View } from "../enums/View.enum";

export interface GlobalVariableContextType {
  currentView: View;
  setCurrentView: (view: View) => void;

  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  username: string;
  setUsername: (username: string) => void;

  email: string;
  setEmail: (email: string) => void;

  accessToken: string;
  setAccessToken: (accessToken: string) => void;


  ping: number;
  setPing: (ping: number) => void;

  totalBatchedPixelCount: number;
  setTotalBatchedPixelCount: (ping: number) => void;

  version: string;
  setVersion: (version: string) => void;
}