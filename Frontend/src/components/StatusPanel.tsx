import React from "react";

type StatusPanelProps = {
  pixelSize: number;
  mousePixelPos: { x: number; y: number } | null;
  pinnedPositionsCount: number;
};

const StatusPanel: React.FC<StatusPanelProps> = ({ pixelSize, mousePixelPos, pinnedPositionsCount }) => (
  <div className="fixed w-65 left-4 top-4 bg-white p-3 flex flex-col items-start rounded-sm border">
    <div className="text-xs text-gray-600 mb-1">픽셀 크기: {pixelSize}px</div>
    <div className="text-xs text-gray-600 mb-1">마우스: {mousePixelPos ? `(${mousePixelPos.x}, ${mousePixelPos.y})` : "(--, --)"}</div>
    <div className="text-xs text-gray-600">고정 위치: {pinnedPositionsCount}</div>
  </div>
);

export default StatusPanel;
