import { useEffect, useState } from "react";
import { Tool } from "../../contexts/enums/Tool.enum";
import { Service } from "./Panel/Service";
import { Chat } from "./Panel/Chat";
import { Brush } from "./Panel/Brush";
import { Profile } from "./Panel/Profile";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { Setting } from "./Panel/Setting";
import { Feedback } from "./Notification";

enum PanelAction {
  MOVE_RIGHT = -1,
  CENTER = 0,
  MOVE_LEFT = 1,
}

export const Panel = () => {
  const [currentTool, setCurrentTool] = useState<number>(0);
  const [activedTool, setActivedTool] = useState<number>(0);
  const [action, setAction] = useState(PanelAction.CENTER);
  const [sliding, setSliding] = useState(false);

  const { activeTool } = useGlobalVariable();

  const PanelMap = [
    '',
    <Brush />,
    <Chat />,
    <Setting />,
    <Profile />,
    <Service />
  ]

  useEffect(() => {
    if (activeTool === Tool.NONE) {
      setAction(PanelAction.CENTER);
      setActivedTool(0);

      const timeout = setTimeout(() => setCurrentTool(0), 301);
      return () => {
        clearTimeout(timeout);
      }
    }
    setActivedTool(activeTool);
    if (activedTool == currentTool && currentTool !== 0 && activedTool !== 0) {
      setAction(PanelAction.CENTER);
      setActivedTool(0);
      return;
    }

    setSliding(true);
    setAction(activeTool > currentTool ? PanelAction.MOVE_RIGHT : PanelAction.MOVE_LEFT);

    const timer = setTimeout(() => {
      setSliding(false);
      setCurrentTool(activeTool);
      setAction(PanelAction.CENTER);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTool, currentTool]);

  const getTranslateX = () => {
    switch (action) {
      case PanelAction.MOVE_LEFT:
        return 'translate-x-0';
      case PanelAction.MOVE_RIGHT:
        return '-translate-x-2/1';
      case PanelAction.CENTER:
      default:
        return '-translate-x-1/1';
    }
  };

  return (
    <div>
      <Feedback />
      <div className={`bg-white/90 backdrop-blur-sm transition-normal duration-200 ease-in-out w-150 ${activeTool === 0 ? "h-0 border-0 border-slate-900/0 shadow-none" : "h-75 border border-slate-900/10 shadow-sm"} rounded-lg relative flex flex-row overflow-hidden`}>
        <div className={`p-6 min-w-1/1 transition-transform ${sliding ? "duration-250" : "duration-0"} ${getTranslateX()} ease-in-out`}>
          {PanelMap[activedTool]}
        </div>
        <div className={`p-6 min-w-1/1 transition-transform ${sliding ? "duration-250" : "duration-0"} ${getTranslateX()} ease-in-out`}>
          {PanelMap[currentTool]}
        </div>
        <div className={`p-6 min-w-1/1 transition-transform ${sliding ? "duration-250" : "duration-0"} ${getTranslateX()} ease-in-out`}>
          {PanelMap[activedTool]}
        </div>
      </div>
    </div>
  );
}