import { DetailedPixel } from "../../contexts/interfaces/Pixel.interface";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { usePixel } from "../../contexts/Pixel.context";

interface PixelInfoProps {
  selectedPixel: DetailedPixel | null;
}

const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return "알 수 없음";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "알 수 없음";

  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatAbsoluteTime = (dateString?: string): string => {
  if (!dateString) return "알 수 없음";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "알 수 없음";

  return date.toLocaleString('ko-KR');
};

export const PixelInfo = ({ selectedPixel }: PixelInfoProps) => {
  const { setSelectedPixel } = usePixel();
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    if (!selectedPixel) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedPixel]);

  if (!selectedPixel) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-surface-raised/95 backdrop-blur-lg border border-border rounded-lg shadow-sm px-3 py-2 min-w-60">
      <div className="space-y-1.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-border"
               style={{ backgroundColor: `rgb(${selectedPixel.colorR}, ${selectedPixel.colorG}, ${selectedPixel.colorB})` }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xs font-bold text-content">픽셀 정보</h3>
              <span className="text-[10px] text-content-subtle">#{selectedPixel.index}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPixel(null)}
            className="p-0.5 rounded text-content-muted hover:text-content hover:bg-surface-hover transition-colors focus-ring"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact Info Grid */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-content-muted">Location</span>
            <span className="font-mono text-content">({selectedPixel.posX}, {selectedPixel.posY})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-content-muted">RGB</span>
            <div className="flex gap-1 font-mono">
              <span className="text-red-400">{selectedPixel.colorR}</span>
              <span className="text-content-subtle">/</span>
              <span className="text-green-400">{selectedPixel.colorG}</span>
              <span className="text-content-subtle">/</span>
              <span className="text-blue-400">{selectedPixel.colorB}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-content-muted">Painted By</span>
            <span className="font-medium text-content truncate max-w-[150px]">
              {selectedPixel.paintedBy ?? "알 수 없음"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-content-muted">Painted At</span>
            <span className="text-content-muted text-[11px]" title={formatAbsoluteTime(selectedPixel.paintedAt)}>
              {formatRelativeTime(selectedPixel.paintedAt)}
            </span>
          </div>

          <div className="pt-1 border-t border-border">
            <p className="text-[9px] text-content-subtle font-mono truncate" title={selectedPixel.uuid}>
              {selectedPixel.uuid}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
