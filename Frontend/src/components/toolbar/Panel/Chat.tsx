import { useGlobalVariable } from "../../../contexts/GlobalVariable.context"
import { Tool } from "../../../contexts/enums/Tool.enum";

export const Chat = () => {
  const { setActiveTool, accessToken } = useGlobalVariable();
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
        <h2 className="text-base font-semibold text-slate-800">채팅</h2>
      </div>

      {!accessToken ?
        <div className="flex flex-1 flex-col justify-center items-center">
          <h3 className="text-md font-semibold">로그인 후 이용하실 수 있습니다.</h3>
          <button onClick={() => setActiveTool(Tool.PROFILE)} className="px-2 py-2 h-9 mt-3 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md">
            로그인 하러 가기
          </button>
        </div>
        : null
      }
    </div>
  )
}