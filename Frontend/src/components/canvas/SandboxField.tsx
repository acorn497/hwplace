import { useEffect, useRef } from "react";
import { useSandbox } from "../../contexts/Sandbox.context";

/**
 * 샌드박스 캔버스.
 *
 * 메인 캔버스 오른쪽에 간격을 두고 붙는다. 좌표계는 메인과 독립이라
 * 이 캔버스 안에서 (0,0)은 이 캔버스의 왼쪽 위다.
 *
 * 구역이 다르다는 것이 한눈에 보여야 하므로 세 가지를 겹쳐 쓴다.
 *  1) 빈 간격 - 축소해도 두 구역이 붙어 보이지 않는다
 *  2) 점선 테두리 - 실선인 메인 캔버스와 구분된다 (임시 공간이라는 관습적 표현)
 *  3) 머리말 라벨 + 남은 시간 - 무엇이고 언제 지워지는지 글자로 알린다
 */
export const SandboxField = ({ zoom }: { zoom: number }) => {
  const { info, getBuffer, epoch, version, consumeDirtyRegions, resetAfter } = useSandbox();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawnEpochRef = useRef(-1);

  // 메인 캔버스의 렌더 경로와 같은 방식이다. (전체 재그리기 → 이후 dirty 영역만)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !info) return;

    const context = canvas.getContext('2d');
    const buffer = getBuffer();
    if (!context || !buffer) return;

    const drawRegion = (x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return;

      const imageData = context.createImageData(width, height);

      for (let row = 0; row < height; row++) {
        let source = ((y + row) * info.width + x) * 3;
        let destination = row * width * 4;

        for (let column = 0; column < width; column++) {
          imageData.data[destination] = buffer[source];
          imageData.data[destination + 1] = buffer[source + 1];
          imageData.data[destination + 2] = buffer[source + 2];
          imageData.data[destination + 3] = 255;
          source += 3;
          destination += 4;
        }
      }

      context.putImageData(imageData, x, y);
    };

    if (drawnEpochRef.current !== epoch) {
      drawnEpochRef.current = epoch;
      drawRegion(0, 0, info.width, info.height);
      consumeDirtyRegions();
      return;
    }

    for (const region of consumeDirtyRegions()) {
      if (region.width === 1 && region.height === 1) {
        const offset = (region.y * info.width + region.x) * 3;
        context.fillStyle = `rgb(${buffer[offset]},${buffer[offset + 1]},${buffer[offset + 2]})`;
        context.fillRect(region.x, region.y, 1, 1);
        continue;
      }

      drawRegion(region.x, region.y, region.width, region.height);
    }
  }, [info, epoch, version, getBuffer, consumeDirtyRegions]);

  if (!info) return null;

  const displayW = info.width * zoom;
  const displayH = info.height * zoom;

  const minutes = Math.floor(resetAfter / 60);
  const seconds = resetAfter % 60;

  return (
    <div className="absolute" style={{ left: 0, top: 0, width: displayW, height: displayH }}>
      {/*
        머리말. 캔버스 위쪽 바깥에 띄운다.
        줌과 무관하게 읽혀야 하므로 크기를 배율에 연동하지 않는다.
      */}
      <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-md bg-warn text-app-bg text-xs font-bold">
          샌드박스
        </span>
        <span className="text-xs text-content-muted">
          {info.width}×{info.height} · API 봇 허용
        </span>
        <span className="text-xs font-medium text-warn tabular-nums">
          {minutes}:{String(seconds).padStart(2, '0')} 후 초기화
        </span>
      </div>

      {/* 점선 테두리 - 임시 공간임을 드러낸다 */}
      <div
        className="absolute pointer-events-none z-10 border-2 border-dashed border-warn/70 rounded-sm"
        style={{ left: -4, top: -4, width: displayW + 8, height: displayH + 8 }}
      />

      <canvas
        ref={canvasRef}
        className="pixelated absolute top-0 left-0"
        width={info.width}
        height={info.height}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
