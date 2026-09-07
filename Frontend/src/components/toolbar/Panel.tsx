import { useEffect, useState, type ReactNode } from "react";
import { Tool } from "../../contexts/enums/Tool.enum";
import { Service } from "./Panel/Service";
import { Chat } from "./Panel/Chat";
import { Brush } from "./Panel/Brush";
import { Profile } from "./Panel/Profile";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { Setting } from "./Panel/Setting";
import { Admin } from "./Panel/Admin";
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
  // 관리자 전용. 툴바가 아이콘을 숨기고, 패널 자체도 권한을 한 번 더 확인한다.
  <Admin />,
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

  /*
    좌/중/우 3칸짜리 트랙을 통째로 밀어 전환 효과를 낸다. 가운데(1)가 현재 패널이고,
    트랙이 향하는 쪽 칸에 다음 패널을 미리 그려둬야 "슬라이드해 들어오는" 그림이 나온다.

    다만 양옆 두 칸에 모두 그리면 안 된다.
    예전 [activedTool, currentTool, activedTool] 방식은 같은 패널을 3벌 mount 시켜
    상태와 단축키 리스너까지 3개가 됐다.
    (F를 누르면 setIsPaintBucketActive 토글이 3번 실행돼 무장이 즉시 풀렸다)

    트랙은 한 번에 한 방향으로만 가므로 '도착할 칸' 하나에만 다음 패널을 올린다.
    그러면 전환 중에도 살아있는 패널은 현재/다음 둘뿐이고, 둘은 서로 다른 패널이라 사본이 생기지 않는다.
  */
  const incomingSlot =
    action === PanelAction.MOVE_LEFT ? 0 :
      action === PanelAction.MOVE_RIGHT ? 2 :
        -1;

  const slotContent = (slot: number) => {
    if (slot === 1) return PanelMap[currentTool];
    // 도착 칸에만, 그리고 현재 패널과 다를 때만 미리 렌더한다.
    if (slot === incomingSlot && activedTool !== currentTool) return PanelMap[activedTool];
    return null;
  };

  const slideClassName = `p-4 min-w-1/1 transition-transform ${sliding ? "duration-250" : "duration-0"} ${getTranslateX()} ease-in-out`;

  return (
    <div>
      <Feedback />
      <div className={`bg-surface backdrop-blur-md transition-normal duration-200 ease-in-out w-136 max-w-[calc(100vw-3rem)] ${activeTool === 0 ? "h-0 border-0 border-transparent shadow-none" : "h-68 border border-border shadow-sm"} rounded-lg relative flex flex-row overflow-hidden`}>
        {[0, 1, 2].map((slot) => (
          <div key={slot} className={slideClassName} aria-hidden={slot !== 1 ? true : undefined}>
            {slotContent(slot)}
          </div>
        ))}
      </div>
    </div>
  );
}