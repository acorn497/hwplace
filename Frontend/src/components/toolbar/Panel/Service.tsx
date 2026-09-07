import { Activity, Globe, History, Palette, Users, Zap } from "lucide-react"
import { useCanvas } from "../../../contexts/Canvas.context"
import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { useSocket } from "../../../contexts/Socket.context";
import { ConnectionStatus } from "../../../contexts/enums/ConnectionStatus.enum";
import { PanelShell, MetricTile } from "../../common/PanelKit";
import { useReplay } from "../../../contexts/Replay.context";

// 연결 상태별 표시 스타일 (Tailwind가 클래스를 정적으로 인식할 수 있도록 완전한 문자열로 매핑)
const STATUS_STYLE: Record<string, { dot: string; text: string; pulse: boolean }> = {
  [ConnectionStatus.CONNECTED]: { dot: "bg-ok", text: "text-ok", pulse: false },
  [ConnectionStatus.CONNECTING]: { dot: "bg-warn", text: "text-warn", pulse: true },
  [ConnectionStatus.DISCONNECTED]: { dot: "bg-danger", text: "text-danger", pulse: false },
  [ConnectionStatus.ERROR]: { dot: "bg-danger", text: "text-danger", pulse: false },
  [ConnectionStatus.FAILED]: { dot: "bg-danger", text: "text-danger", pulse: false },
};

export const Service = () => {
  const { canvasSizeX, canvasSizeY } = useCanvas();
  const { ping, totalBatchedPixelCount, version } = useGlobalVariable();
  const { connectionStatus, onlineUsers } = useSocket();
  const { enter: enterReplay, status: replayStatus } = useReplay();

  const statusStyle = STATUS_STYLE[connectionStatus] ?? STATUS_STYLE[ConnectionStatus.DISCONNECTED];

  return (
    <PanelShell
      title="HWPlace 서비스 정보"
      actions={
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${statusStyle.dot} ${statusStyle.pulse ? "animate-pulse" : ""}`}
          />
          <span className={`text-xs font-medium ${statusStyle.text}`}>{connectionStatus}</span>
        </div>
      }
    >
      {/*
        메트릭 그리드.
        h-full + 기본 grid-auto-rows 는 4개 행(타일 2줄 + 전체폭 2줄)을 같은 높이로 늘려서,
        한 줄짜리 타임랩스/버전 행이 타일과 같은 높이를 먹고 결국 패널 밖으로 밀려났다.
        타일 줄만 남는 높이를 나눠 갖고(1fr), 한 줄짜리 행은 내용 높이(auto)만 쓰게 한다.
      */}
      <div className="grid h-full grid-cols-2 grid-rows-[1fr_1fr_auto_auto] gap-2">
        <MetricTile icon={<Zap className="w-4 h-4" />} label="지연시간" value={`${ping} ms`} />
        <MetricTile
          icon={<Users className="w-4 h-4" />}
          label="연결된 사용자 수"
          value={onlineUsers === null ? "-" : onlineUsers.toLocaleString()}
        />
        <MetricTile icon={<Palette className="w-4 h-4" />} label="캔버스 크기" value={`${canvasSizeX} x ${canvasSizeY}`} />
        <MetricTile
          icon={<Activity className="w-4 h-4" />}
          label="지금까지 배치된 픽셀 수"
          value={totalBatchedPixelCount.toLocaleString()}
        />

        {/* 타임랩스 진입 - 전체 너비 */}
        <button
          onClick={() => void enterReplay()}
          disabled={replayStatus === 'loading'}
          className="focus-ring col-span-2 flex items-center justify-between px-3 py-1.5 bg-accent-soft rounded-lg border border-border transition-colors hover:bg-surface-hover disabled:opacity-60 disabled:cursor-default cursor-pointer"
        >
          <div className="flex items-center gap-2 text-content-muted">
            <History className="w-4 h-4" />
            <span className="text-xs font-medium">타임랩스</span>
          </div>
          <div className="text-sm font-medium text-content">
            {replayStatus === 'loading' ? '불러오는 중...' : '전체 기간 재생'}
          </div>
        </button>

        {/* 버전 - 전체 너비 */}
        <div className="col-span-2 flex items-center justify-between px-3 py-1.5 bg-accent-soft rounded-lg border border-border">
          <div className="flex items-center gap-2 text-content-muted">
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">UI / 서비스 버전</span>
          </div>
          <div className="text-sm font-medium text-content">{version}</div>
        </div>
      </div>
    </PanelShell>
  )
}
