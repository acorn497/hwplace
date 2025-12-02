import { Activity, Globe, Palette, Users, Zap } from "lucide-react"

export const Service = () => {


  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
        <h2 className="text-base font-semibold text-slate-800">HWPlace 서비스 정보</h2>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full bg-green-500`} />
          <span className={`text-xs font-medium text-green-500`}>연결됨</span>
        </div>
      </div>

      {/* 메트릭 그리드 */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {/* 핑 */}
        <div className="flex flex-col justify-between p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-slate-900/5">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium">지연시간</span>
          </div>
          <div className="text-xl font-bold text-slate-800">14 ms</div>
        </div>

        {/* 접속자 */}
        <div className="flex flex-col justify-between p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-slate-900/5">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">연결된 사용자 수</span>
          </div>
          <div className="text-xl font-bold text-slate-800">4</div>
        </div>

        {/* 캔버스 크기 */}
        <div className="flex flex-col justify-between p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-slate-900/5">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <Palette className="w-4 h-4" />
            <span className="text-xs font-medium">캔버스 크기</span>
          </div>
          <div className="text-xl font-bold text-slate-800">1000 x 1000</div>
        </div>

        {/* 칠해진 픽셀 */}
        <div className="flex flex-col justify-between p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-slate-900/5">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">지금까지 배치된 픽셀 수</span>
          </div>
          <div className="text-xl font-bold text-slate-800">141,203</div>
        </div>

        {/* 버전 - 전체 너비 */}
        <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-linear-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-lg border border-cyan-500/20">
          <div className="flex items-center gap-2 text-slate-600">
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">UI / 서비스 버전</span>
          </div>
          <div className="text-sm font-medium text-slate-800">v2.0.0-preview</div>
        </div>
      </div>
    </div>
  )
}