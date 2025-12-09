import { BookA, Brush, IdCard, MessagesSquare, SquareMousePointer } from "lucide-react"

import { Tool } from "../../contexts/enums/Tool.enum"
import { Panel } from "./Panel";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { Notification } from "./Notification";

const ToolMap = [
  { tool: Tool.NONE, icon: <SquareMousePointer /> },
  { tool: Tool.BRUSH, icon: <Brush /> },
  { tool: Tool.CHAT, icon: <MessagesSquare /> },
  { tool: Tool.PROFILE, icon: <IdCard /> },
  { tool: Tool.SERVICE, icon: <BookA /> },
];

export const Toolbar = () => {
  const { activeTool, setActiveTool } = useGlobalVariable();

  // 툴바 단축키 등록
  ToolMap.map((tool, index) => useKeyboardShortcut((index + 1).toString(), () => setActiveTool(tool.tool)));

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6">
      <div className="relative flex flex-col items-center">
        <Notification />
        <Panel />
        <div className="relative flex items-center gap-2 bg-white/20 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-slate-900/10 shadow-sm shadow-black/5 mt-4">
          {ToolMap.map((tool, index) => {
            const isActive = activeTool === tool.tool;
            return (
              <button
                key={index}
                className={`relative p-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'hover:bg-black/5 text-slate-700 hover:text-slate-900'}`}
                onClick={() => setActiveTool(tool.tool)}
              >
                <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-105' : 'scale-100'}`}>
                  {tool.icon}
                  <span className="absolute -right-1.5 -bottom-2 text-xs text-slate-300">{index + 1}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  )
}