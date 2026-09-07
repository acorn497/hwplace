import { useState } from "react";
import { Crosshair, Eraser } from "lucide-react";
import { FetchMethod, apiFetch } from "../../../../hooks/useFetch";
import { useNotification } from "../../../../contexts/Notification.context";
import { useCanvas } from "../../../../contexts/Canvas.context";
import { Type } from "../../../../contexts/enums/Type.enum";
import { PanelSection } from "../../../common/PanelKit";

const INPUT_CLASS =
  "focus-ring w-full px-2 py-1.5 bg-surface-solid border border-border rounded-lg text-sm text-content placeholder:text-content-subtle transition-colors";

/**
 * 이보다 넓은 영역을 지울 때는 한 번 더 확인한다.
 * 실수로 0,0 ~ 캔버스 끝을 넣으면 캔버스 전체가 날아가기 때문이다.
 */
const LARGE_AREA_THRESHOLD = 10_000;

export const CanvasManager = () => {
  const [area, setArea] = useState({ x1: '', y1: '', x2: '', y2: '' });
  const [submitting, setSubmitting] = useState(false);

  const { setNotification } = useNotification();
  const { cursorPosition, canvasSizeX, canvasSizeY } = useCanvas();

  const handleChange = (key: keyof typeof area) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setArea((previous) => ({ ...previous, [key]: event.target.value }));
  };

  /** 지금 커서가 있는 칸을 시작/끝 좌표로 넣어준다. 좌표를 눈으로 읽어 옮겨 적는 수고를 던다. */
  const fillFromCursor = (corner: 'start' | 'end') => {
    const x = String(cursorPosition.x);
    const y = String(cursorPosition.y);

    setArea((previous) => corner === 'start'
      ? { ...previous, x1: x, y1: y }
      : { ...previous, x2: x, y2: y });
  };

  const parsed = {
    x1: Number(area.x1),
    y1: Number(area.y1),
    x2: Number(area.x2),
    y2: Number(area.y2),
  };

  const isFilled = Object.values(area).every((value) => value !== '');
  const isValid = isFilled && Object.values(parsed).every((value) => Number.isInteger(value) && value >= 0);

  const pixelCount = isValid
    ? (Math.abs(parsed.x2 - parsed.x1) + 1) * (Math.abs(parsed.y2 - parsed.y1) + 1)
    : 0;

  const handleClear = async () => {
    if (!isValid) return;

    const confirmMessage = pixelCount >= LARGE_AREA_THRESHOLD
      ? `${pixelCount.toLocaleString()}개의 픽셀을 초기화합니다.\n넓은 영역입니다. 정말 진행할까요?`
      : `${pixelCount.toLocaleString()}개의 픽셀을 초기화합니다. 계속할까요?`;

    if (!window.confirm(confirmMessage)) return;

    setSubmitting(true);

    const result = await apiFetch(FetchMethod.POST, '/admin/canvas/clear', parsed);

    if (result.internalStatusCode !== '0000') {
      setNotification({
        title: '영역 초기화',
        content: result.message ?? '초기화하지 못했습니다.',
        type: Type.WARNING,
      });
      setSubmitting(false);
      return;
    }

    setNotification({ title: '영역 초기화', content: result.message ?? '초기화했습니다.' });
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto px-1 -mx-1">
      <PanelSection
        title="영역 초기화"
        description={`선택한 사각 영역을 흰색으로 되돌립니다. (캔버스 ${canvasSizeX} x ${canvasSizeY})`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
              <div>
                <label htmlFor="admin-x1" className="text-[11px] text-content-muted">시작 X</label>
                <input id="admin-x1" type="number" min={0} value={area.x1} onChange={handleChange('x1')} className={INPUT_CLASS} placeholder="0" />
              </div>
              <div>
                <label htmlFor="admin-y1" className="text-[11px] text-content-muted">시작 Y</label>
                <input id="admin-y1" type="number" min={0} value={area.y1} onChange={handleChange('y1')} className={INPUT_CLASS} placeholder="0" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fillFromCursor('start')}
              title="현재 커서 위치를 시작 좌표로"
              aria-label="현재 커서 위치를 시작 좌표로"
              className="focus-ring p-1.5 mb-0.5 rounded-md text-content-muted hover:bg-surface-hover hover:text-content transition-colors cursor-pointer shrink-0"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
              <div>
                <label htmlFor="admin-x2" className="text-[11px] text-content-muted">끝 X</label>
                <input id="admin-x2" type="number" min={0} value={area.x2} onChange={handleChange('x2')} className={INPUT_CLASS} placeholder="0" />
              </div>
              <div>
                <label htmlFor="admin-y2" className="text-[11px] text-content-muted">끝 Y</label>
                <input id="admin-y2" type="number" min={0} value={area.y2} onChange={handleChange('y2')} className={INPUT_CLASS} placeholder="0" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fillFromCursor('end')}
              title="현재 커서 위치를 끝 좌표로"
              aria-label="현재 커서 위치를 끝 좌표로"
              className="focus-ring p-1.5 mb-0.5 rounded-md text-content-muted hover:bg-surface-hover hover:text-content transition-colors cursor-pointer shrink-0"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-content-muted">
              {isValid ? `${pixelCount.toLocaleString()}개 픽셀` : '좌표를 입력하세요'}
            </span>
            <button
              type="button"
              disabled={!isValid || submitting}
              onClick={() => void handleClear()}
              className="focus-ring flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger text-app-bg text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity shadow-sm cursor-pointer disabled:bg-surface-hover disabled:text-content-subtle disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Eraser className="w-4 h-4" />
              {submitting ? '처리 중...' : '초기화'}
            </button>
          </div>
        </div>
      </PanelSection>
    </div>
  );
};
