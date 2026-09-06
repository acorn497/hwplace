import { useEffect, useRef, useState } from "react";
import { BookA, Brush, IdCard, MessagesSquare, Settings, SquareMousePointer } from "lucide-react"

import { Tool } from "../../contexts/enums/Tool.enum"
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { useChat } from "../../contexts/Chat.context";

// 툴바 호버 툴팁이 나타나기까지의 지연 시간 (ms) - Button 컴포넌트와 동일하게 맞춤
const TOOLTIP_TTL = 500;

const ToolMap = [
  { tool: Tool.NONE, icon: <SquareMousePointer />, label: "선택" },
  { tool: Tool.BRUSH, icon: <Brush />, label: "색칠하기" },
  { tool: Tool.CHAT, icon: <MessagesSquare />, label: "채팅" },
  { tool: Tool.SETTING, icon: <Settings />, label: "설정" },
  { tool: Tool.PROFILE, icon: <IdCard />, label: "프로필" },
  { tool: Tool.SERVICE, icon: <BookA />, label: "서비스 정보" },
];

export const Toolbar = () => {
  const { activeTool, setActiveTool } = useGlobalVariable();
  const { unreadCount } = useChat();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);

  // 툴바 단축키 등록 - 훅은 항상 최상위에서 한 번만 호출되어야 하므로
  // ToolMap 전체를 순회하는 키다운 핸들러 하나만 등록한다.
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable)
        return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
        return;

      const index = ToolMap.findIndex((_, i) => String(i + 1) === event.key);
      if (index === -1) return;

      event.preventDefault();
      setActiveTool(ToolMap[index].tool);
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    }
  }, [setActiveTool]);

  const clearTooltipTimer = () => {
    if (tooltipTimerRef.current !== null) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  const handleMouseEnter = (index: number) => {
    clearTooltipTimer();
    tooltipTimerRef.current = window.setTimeout(() => setHoveredIndex(index), TOOLTIP_TTL);
  };

  const handleMouseLeave = () => {
    clearTooltipTimer();
    setHoveredIndex(null);
  };

  useEffect(() => clearTooltipTimer, []);

  return (
    <div className="fixed flex flex-col items-center bottom-10 left-1/2 -translate-x-1/2">
      <div className="relative flex items-center gap-2 bg-surface backdrop-blur-md px-2 py-1.5 rounded-2xl border border-border shadow-sm shadow-black/5 mt-4">
        {ToolMap.map((tool, index) => {
          const isActive = activeTool === tool.tool;
          return (
            <div key={index} className="relative" onMouseEnter={() => handleMouseEnter(index)} onMouseLeave={handleMouseLeave}>
              {/* Button 컴포넌트의 툴팁과 동일한 스타일 - 테마와 무관하게 항상 읽히도록 본문색/배경색을 서로 뒤집어 쓴다 */}
              <div className={`${hoveredIndex === index ? "opacity-100" : "opacity-0 select-none pointer-events-none"} absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-fit overflow-hidden transition-normal duration-200 bg-content/80 backdrop-blur-md py-1 px-2 text-sm rounded-md text-app-bg font-medium whitespace-nowrap`}>
                <span>{tool.label}</span>
                <><br /><span className="text-xs font-light">Key </span><span className="text-xs italic">{index + 1}</span></>
              </div>
              <button
                type="button"
                aria-label={tool.label}
                aria-pressed={isActive}
                title={tool.label}
                className={`relative p-3 rounded-xl transition-all duration-200 cursor-pointer focus-ring ${isActive ? 'bg-accent text-accent-fg shadow-md shadow-accent/30' : 'hover:bg-surface-hover text-content-muted hover:text-content'}`}
                onClick={() => setActiveTool(tool.tool)}
              >
                <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-105' : 'scale-100'}`}>
                  {tool.icon}
                  <span className={`absolute -right-1.5 -bottom-2 text-xs ${isActive ? 'text-accent-fg' : 'text-content-subtle'} transition-colors duration-200`}>{index + 1}</span>
                  {/* 채팅 탭이 열려있지 않을 때만 안 읽은 메시지 수를 표시 */}
                  {tool.tool === Tool.CHAT && unreadCount > 0 && !isActive ?
                    <span
                      aria-label={`읽지 않은 메시지 ${unreadCount}개`}
                      className="absolute -top-2 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-danger text-app-bg text-[10px] font-semibold leading-none shadow-sm"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                    : null}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  )
}
