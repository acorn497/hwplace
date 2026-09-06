import { useEffect, useState, type ReactNode } from "react";
import { Tool } from "../../contexts/enums/Tool.enum";
import { Service } from "./Panel/Service";
import { Chat } from "./Panel/Chat";
import { Brush } from "./Panel/Brush";
import { Profile } from "./Panel/Profile";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { Setting } from "./Panel/Setting";
import { Feedback } from "./Notification";

// 다음 패널이 이전 패널 기준 어느 쪽에서 들어오는지를 나타내는 슬라이드 방향
enum PanelAction {
  MOVE_RIGHT = -1,
  CENTER = 0,
  MOVE_LEFT = 1,
}

// Tool enum과 1:1로 대응하는 패널 목록. Tool.NONE(0)엔 표시할 패널이 없으므로 null.
const PanelMap: (ReactNode | null)[] = [
  null,
  <Brush />,
  <Chat />,
  <Setting />,
  <Profile />,
  <Service />,
];

export const Panel = () => {
  const [currentTool, setCurrentTool] = useState<number>(0);
  const [activedTool, setActivedTool] = useState<number>(0);
  const [action, setAction] = useState(PanelAction.CENTER);
  const [sliding, setSliding] = useState(false);

  const { activeTool } = useGlobalVariable();

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

  // 좌/중/우 3장을 겹쳐두고 트랙 전체를 슬라이드시켜 전환 효과를 낸다 (가운데 칸이 항상 currentTool).
  const track = [activedTool, currentTool, activedTool];
  const slideClassName = `p-6 min-w-1/1 transition-transform ${sliding ? "duration-250" : "duration-0"} ${getTranslateX()} ease-in-out`;

  return (
    <div>
      <Feedback />
      <div className={`bg-surface backdrop-blur-md transition-normal duration-200 ease-in-out w-150 ${activeTool === 0 ? "h-0 border-0 border-transparent shadow-none" : "h-75 border border-border shadow-sm"} rounded-lg relative flex flex-row overflow-hidden`}>
        {track.map((toolIndex, i) => (
          <div key={i} className={slideClassName}>
            {PanelMap[toolIndex]}
          </div>
        ))}
      </div>
    </div>
  );
}