import { Activity, Globe, Palette, Users, Zap } from "lucide-react"
import { useCanvas } from "../../../contexts/Canvas.context"
import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { useSocket } from "../../../contexts/Socket.context";
import { ConnectionStatus } from "../../../contexts/enums/ConnectionStatus.enum";
import { PanelShell, MetricTile } from "../../common/PanelKit";

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
      {/* 메트릭 그리드 */}
      <div className="grid grid-cols-2 gap-2 h-full">
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

        {/* 버전 - 전체 너비 */}
        <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-accent-soft rounded-lg border border-border">
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
