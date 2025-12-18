import { DetailedPixel } from "../../contexts/interfaces/Pixel.interface";
import { useEffect, useState } from "react";

interface PixelInfoProps {
  selectedPixel: DetailedPixel | null;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
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

export const PixelInfo = ({ selectedPixel }: PixelInfoProps) => {
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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-primary-modal/95 backdrop-blur-lg border border-primary-border/50 rounded-lg shadow-sm px-3 py-2 min-w-60">
      <div className="space-y-1.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-primary-border/50"
               style={{ backgroundColor: `rgb(${selectedPixel.colorR}, ${selectedPixel.colorG}, ${selectedPixel.colorB})` }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xs font-bold text-primary-text">픽셀 정보</h3>
              <span className="text-[10px] text-primary-text/50">#{selectedPixel.index}</span>
            </div>
          </div>
        </div>

        {/* Compact Info Grid */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-primary-text/60">Location</span>
            <span className="font-mono text-primary-text">({selectedPixel.posX}, {selectedPixel.posY})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-primary-text/60">RGB</span>
            <div className="flex gap-1 font-mono">
              <span className="text-red-400">{selectedPixel.colorR}</span>
              <span className="text-primary-text/40">/</span>
              <span className="text-green-400">{selectedPixel.colorG}</span>
              <span className="text-primary-text/40">/</span>
              <span className="text-blue-400">{selectedPixel.colorB}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-primary-text/60">Painted By</span>
            <span className="font-medium text-primary-text truncate max-w-[150px]">
              {selectedPixel.paintedBy}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-primary-text/60">Painted At</span>
            <span className="text-primary-text/80 text-[11px]" title={new Date(selectedPixel.paintedAt).toLocaleString('ko-KR')}>
              {formatRelativeTime(selectedPixel.paintedAt)}
            </span>
          </div>

          <div className="pt-1 border-t border-primary-border/20">
            <p className="text-[9px] text-primary-text/40 font-mono truncate" title={selectedPixel.uuid}>
              {selectedPixel.uuid}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
