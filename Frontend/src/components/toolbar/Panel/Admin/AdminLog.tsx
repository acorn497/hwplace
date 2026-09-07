import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FetchMethod, apiFetch } from "../../../../hooks/useFetch";

interface LogEntry {
  index: number;
  action: string;
  admin: string;
  targetUser: number | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** 동작 코드를 사람이 읽는 말로 */
const ACTION_LABEL: Record<string, string> = {
  BAN: '제재',
  UNBAN: '제재 해제',
  ROLE_CHANGE: '권한 변경',
  CLEAR_AREA: '영역 초기화',
  ROLLBACK_USER: '픽셀 롤백',
  AUTO_RESTRICT: '자동 제재',
};

/** 위험한 동작은 눈에 띄게 */
const ACTION_TONE: Record<string, string> = {
  BAN: 'bg-danger text-app-bg',
  CLEAR_AREA: 'bg-danger text-app-bg',
  ROLLBACK_USER: 'bg-warn text-app-bg',
  AUTO_RESTRICT: 'bg-danger text-app-bg',
};

const summarize = (entry: LogEntry) => {
  const detail = entry.detail as any;
  if (!detail) return '';

  switch (entry.action) {
    case 'CLEAR_AREA':
      return `(${detail.area?.x1}, ${detail.area?.y1}) ~ (${detail.area?.x2}, ${detail.area?.y2}) · ${Number(detail.pixels ?? 0).toLocaleString()}px`;
    case 'ROLLBACK_USER':
      return `${detail.email ?? ''} · ${Number(detail.pixels ?? 0).toLocaleString()}px`;
    case 'ROLE_CHANGE':
      return `${detail.email ?? ''} · ${detail.from} → ${detail.to}`;
    case 'AUTO_RESTRICT':
      return `${detail.email ?? ''} · 쿼터 ${detail.strikes}회 초과`;
    default:
      return detail.email ?? '';
  }
};

export const AdminLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch(FetchMethod.GET, '/admin/logs?limit=50');

    if (result.internalStatusCode === '0000') setLogs(result.data.logs);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs text-content-muted">최근 관리 기록</span>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="기록 새로고침"
          title="새로고침"
          className="focus-ring p-1.5 rounded-lg text-content-muted hover:bg-surface-hover hover:text-content transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 px-1 -mx-1">
        {logs.length === 0 && !loading ?
          <p className="text-xs text-content-muted text-center py-4">아직 기록이 없습니다.</p>
          : null}

        {logs.map((entry) => (
          <div key={entry.index} className="px-2.5 py-2 rounded-lg bg-surface-hover border border-border">
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${ACTION_TONE[entry.action] ?? 'bg-border-strong text-content'}`}>
                {ACTION_LABEL[entry.action] ?? entry.action}
              </span>
              <span className="text-xs text-content truncate">{entry.admin}</span>
              <span className="text-[11px] text-content-subtle ml-auto shrink-0">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            {summarize(entry) ?
              <p className="text-[11px] text-content-muted mt-0.5 truncate">{summarize(entry)}</p>
              : null}
          </div>
        ))}
      </div>
    </div>
  );
};
