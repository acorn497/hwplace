import { useGlobalVariable } from "../../../contexts/GlobalVariable.context";
import { Tool } from "../../../contexts/enums/Tool.enum";
import { useCallback, useEffect, useRef, useState } from "react";
import { ColorInput, hexToRgba, RgbColor, RgbColorPicker, rgbaToHex, rgbaToRgb, validHex } from "./Brush/ColorPicker";
import { Button } from "../../common/Button";
import { PanelShell, LoginGate, SegmentedControl } from "../../common/PanelKit";
import { useCanvas } from "../../../contexts/Canvas.context";
import { DragMode } from "../../../contexts/enums/DragMode.enum";
import { usePixel } from "../../../contexts/Pixel.context";
import { FetchMethod, useFetch } from "../../../hooks/useFetch";
import { useAuth } from "../../../contexts/Auth.context";
import { useKeyboardShortcut } from "../../../hooks/useKeyboardShortcut";
import { useNotification } from "../../../contexts/Notification.context";
import { Type } from "../../../contexts/enums/Type.enum";
import { MousePointer2, PaintBucket, Pipette, SquareDashed } from "lucide-react";
import { BFS } from "../../../utils/bfs";

type ColorFormat = "RGB" | "HEX";
type RgbChannel = "r" | "g" | "b";

// 주변 픽셀 선택(페인트 버킷) 최대 개수 -- src/utils/bfs.ts 와 동일한 기준을 사용
const BFS_LIMIT = Number(import.meta.env.VITE_BFS_SIZE ?? 500);

// 최근 사용한 색상 저장 개수 / localStorage 키
const RECENT_COLOR_LIMIT = 8;
const RECENT_COLOR_KEY = "recentColors";

const RGB_CHANNELS: { key: RgbChannel; label: string }[] = [
  { key: "r", label: "R" },
  { key: "g", label: "G" },
  { key: "b", label: "B" },
];

// 채널 슬라이더 트랙 색상.
// 다른 채널 값을 섞으면(예: R 트랙에 현재 G/B를 얹으면) 트랙이 탁해져서
// "이게 무슨 채널인지"도 "값이 어디쯤인지"도 읽히지 않는다.
// 해당 채널만 0->255로 가는 순수 램프를 써서 라벨(R/G/B)과 색이 항상 일치하게 한다.
const CHANNEL_TRACK: Record<RgbChannel, string> = {
  r: "linear-gradient(to right, #000, #f00)",
  g: "linear-gradient(to right, #000, #0f0)",
  b: "linear-gradient(to right, #000, #00f)",
};

const FORMAT_OPTIONS: { value: ColorFormat; label: string }[] = [
  { value: "RGB", label: "RGB" },
  { value: "HEX", label: "HEX" },
];

// 드래그 모드별 표시 문구/색상. enum 값을 그대로 노출하면 "NORMAL"처럼 읽히지 않아 한글 라벨을 둔다.
const DRAG_MODE_META: Record<DragMode, { label: string; icon: typeof MousePointer2; tone: string }> = {
  [DragMode.NONE]: { label: "이동", icon: MousePointer2, tone: "text-content-muted" },
  [DragMode.SELECT]: { label: "선택", icon: SquareDashed, tone: "text-accent" },
  [DragMode.CANCEL]: { label: "선택 해제", icon: SquareDashed, tone: "text-danger" },
};

const isRgbColor = (value: unknown): value is RgbColor => {
  if (!value || typeof value !== "object") return false;
  const { r, g, b } = value as RgbColor;
  return typeof r === "number" && typeof g === "number" && typeof b === "number";
}

// 밝은 색 위에 흰 테두리를 얹으면 사라져 보이므로, 명도에 따라 테두리 대비를 뒤집는다.
const isLightColor = ({ r, g, b }: RgbColor) => (r * 299 + g * 587 + b * 114) / 1000 > 186;

export const Brush = () => {
  const { setActiveTool } = useGlobalVariable();
  const { cursorPosition, dragMode, canvasClick, isCloneColorActive, setIsCloneColorActive, isPaintBucketActive, setIsPaintBucketActive, canvasSizeX, canvasSizeY } = useCanvas();
  const { selectedPixels, setSelectedPixels, getPixelColor } = usePixel();
  const { accessToken } = useAuth();
  const { setNotification } = useNotification();

  const [currentColor, setCurrentColor] = useState(() => {
    const lastUsedRed = parseInt(localStorage.getItem('R') ?? '');
    const lastUsedGreen = parseInt(localStorage.getItem('G') ?? '');
    const lastUsedBlue = parseInt(localStorage.getItem('B') ?? '');
    return {
      r: isNaN(lastUsedRed) ? 58 : lastUsedRed,
      g: isNaN(lastUsedGreen) ? 118 : lastUsedGreen,
      b: isNaN(lastUsedBlue) ? 118 : lastUsedBlue
    }
  });

  // RGB / HEX 입력 포맷 -- 새로고침 후에도 유지되도록 R/G/B 값과 함께 저장
  const [colorFormat, setColorFormat] = useState<ColorFormat>(() => {
    return localStorage.getItem('FORMAT') === 'HEX' ? 'HEX' : 'RGB';
  });

  // 칠하기 요청 진행 중 여부 -- 중복 제출 방지
  const [isPaintPending, setIsPaintPending] = useState(false);

  const [recentColors, setRecentColors] = useState<RgbColor[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_COLOR_KEY) ?? '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(isRgbColor).slice(0, RECENT_COLOR_LIMIT);
    } catch {
      return [];
    }
  });

  // R/G/B 숫자 입력창 임시 텍스트 -- 입력 도중 빈 문자열을 허용하기 위한 상태
  const [rgbDraft, setRgbDraft] = useState({
    r: currentColor.r.toString(),
    g: currentColor.g.toString(),
    b: currentColor.b.toString(),
  });
  const [editingField, setEditingField] = useState<RgbChannel | null>(null);

  // HEX 입력창 유효성 표시 상태
  const [isHexInvalid, setIsHexInvalid] = useState(false);

  // 페인트통이 '지금' 어떤 드래그 모드인지 봐야 하지만, 이것 때문에 클릭 처리 effect가
  // 재실행될 이유는 없으므로 ref로 최신값만 들고 있는다.
  const dragModeRef = useRef(dragMode);
  useEffect(() => { dragModeRef.current = dragMode; }, [dragMode]);

  const clampColor = (value: number) => Math.max(0, Math.min(255, value));

  useEffect(() => {
    if (!isNaN(currentColor.r) && !isNaN(currentColor.g) && !isNaN(currentColor.b)) {
      localStorage.setItem('R', currentColor.r.toString());
      localStorage.setItem('G', currentColor.g.toString());
      localStorage.setItem('B', currentColor.b.toString());
    }
  }, [currentColor]);

  useEffect(() => {
    localStorage.setItem('FORMAT', colorFormat);
  }, [colorFormat]);

  // 편집 중이 아닌 필드만 currentColor 기준으로 동기화 (편집 중인 필드는 사용자가 지운 값을 유지)
  useEffect(() => {
    setRgbDraft(prev => ({
      r: editingField === 'r' ? prev.r : currentColor.r.toString(),
      g: editingField === 'g' ? prev.g : currentColor.g.toString(),
      b: editingField === 'b' ? prev.b : currentColor.b.toString(),
    }));
  }, [currentColor, editingField]);

  const handleRgbFieldChange = (field: RgbChannel) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setRgbDraft(prev => ({ ...prev, [field]: raw }));

    if (raw === '') return; // 지우는 중에는 currentColor를 건드리지 않음

    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;

    setCurrentColor(prev => ({ ...prev, [field]: clampColor(parsed) }));
  };

  const handleRgbFieldFocus = (field: RgbChannel) => () => setEditingField(field);

  const handleRgbFieldBlur = (field: RgbChannel) => () => {
    setEditingField(null);
    setRgbDraft(prev => {
      const parsed = parseInt(prev[field], 10);
      const clamped = isNaN(parsed) ? currentColor[field] : clampColor(parsed);
      if (clamped !== currentColor[field]) {
        setCurrentColor(color => ({ ...color, [field]: clamped }));
      }
      return { ...prev, [field]: clamped.toString() };
    });
  };

  // 슬라이더로도 채널을 조절할 수 있게 한다 (숫자 입력과 양방향으로 같은 상태를 공유)
  const handleChannelSlide = (field: RgbChannel) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentColor(prev => ({ ...prev, [field]: clampColor(parseInt(event.target.value, 10)) }));
  };

  // HEX <-> RGB 변환은 ColorPicker.tsx의 검증된 헬퍼를 그대로 사용
  const hexEscape = (value: string) => value.replace(/([^0-9A-F]+)/gi, "").substring(0, 6);
  const hexFormat = (value: string) => ("#" + value).toUpperCase();
  const hexProcess = (value: string) => "#" + value;
  const validateHex = (value: string) => {
    const valid = validHex(value);
    setIsHexInvalid(!valid);
    return valid;
  };

  const pushRecentColor = (color: RgbColor) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => !(c.r === color.r && c.g === color.g && c.b === color.b));
      const next = [{ r: color.r, g: color.g, b: color.b }, ...filtered].slice(0, RECENT_COLOR_LIMIT);
      localStorage.setItem(RECENT_COLOR_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handlePaintPixels = async () => {
    if (selectedPixels.length === 0 || isPaintPending) return;

    setIsPaintPending(true);

    const paintRequest = selectedPixels.map(pixel => ({
      posX: pixel.x,
      posY: pixel.y,
      colorR: currentColor.r,
      colorG: currentColor.g,
      colorB: currentColor.b
    }));

    try {
      const result = await useFetch(FetchMethod.POST, '/paint', paintRequest);
      const status = result.internalStatusCode?.toString();

      if (!status?.match('0000')) {
        setNotification({
          title: '칠하기',
          content: result.message || '칠하기에 실패했습니다. 잠시 후 다시 시도해주세요.',
          type: Type.WARNING
        });
        return;
      }

      setNotification({ title: '칠하기', content: `${paintRequest.length}개의 픽셀을 칠했습니다.` });
      pushRecentColor(currentColor);
      setSelectedPixels([]);
    } catch {
      setNotification({ title: '칠하기', content: '서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', type: Type.ERROR });
    } finally {
      setIsPaintPending(false);
    }
  };

  // 좌표를 인자로 받는다 -- 클릭 시점의 좌표를 그대로 쓰기 위해서다.
  // (cursorPosition을 클로저로 읽으면 effect 의존성에서 빠져 낡은 좌표가 잡힌다)
  const applyPaintBucket = useCallback((originX: number, originY: number) => {
    const targetColor = getPixelColor(originX, originY);
    const bfsResult = BFS(originX, originY, targetColor, getPixelColor, canvasSizeX, canvasSizeY);

    switch (dragModeRef.current) {
      case DragMode.NONE:
      case DragMode.SELECT:
        setSelectedPixels(prev => {
          const newPixels = [...prev];
          bfsResult.forEach(pixelPos => {
            if (newPixels.findIndex(p => p.x === pixelPos.x && p.y === pixelPos.y) === -1) {
              newPixels.push({ x: pixelPos.x, y: pixelPos.y });
            }
          });
          return newPixels;
        });
        break;
      case DragMode.CANCEL:
        setSelectedPixels(prev => {
          return prev.filter(p => !bfsResult.some(bfsPixel => bfsPixel.x === p.x && bfsPixel.y === p.y));
        });
        break;
    }
  }, [getPixelColor, canvasSizeX, canvasSizeY, setSelectedPixels]);

  /*
    캔버스를 클릭한 순간에만 도구를 발동시킨다.
    전역 mousedown(isLeftDown)을 보던 시절엔 '채우기' 버튼을 마우스로 누르는 클릭 자체가
    조건을 만족시켜, 캔버스를 찍기도 전에 직전 커서 좌표에서 발동해 버렸다.
    (커서 좌표는 캔버스 위에서만 갱신되므로 엉뚱한 칸이 처리된다)
    seq를 키로 삼아 같은 칸을 연속 클릭해도 매번 반응하게 한다.
  */
  const handledClickSeq = useRef(-1);

  useEffect(() => {
    if (!canvasClick || canvasClick.seq === handledClickSeq.current) return;
    if (!isCloneColorActive && !isPaintBucketActive) return;

    handledClickSeq.current = canvasClick.seq;

    if (isCloneColorActive) {
      setCurrentColor(getPixelColor(canvasClick.x, canvasClick.y));
      setIsCloneColorActive(false);
      return;
    }

    applyPaintBucket(canvasClick.x, canvasClick.y);
    setIsPaintBucketActive(false);
  }, [canvasClick, isCloneColorActive, isPaintBucketActive, getPixelColor, applyPaintBucket, setIsCloneColorActive, setIsPaintBucketActive]);

  useKeyboardShortcut('Enter', handlePaintPixels);
  useKeyboardShortcut('C', () => setIsCloneColorActive(!isCloneColorActive));
  useKeyboardShortcut('F', () => setIsPaintBucketActive(!isPaintBucketActive));

  const hasSelection = selectedPixels.length > 0;
  const isPaintDisabled = isPaintPending || !hasSelection;
  const colorCss = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
  const hexLabel = rgbaToHex({ ...currentColor, a: 1 }).toUpperCase();

  // 색 면 위에 글자를 얹으므로 배경 밝기에 따라 대비색을 고른다 (테마 토큰이 아니라 고정색)
  const swatchTextClass = isLightColor(currentColor) ? 'text-black/70' : 'text-white/85';

  const dragMeta = DRAG_MODE_META[dragMode] ?? DRAG_MODE_META[DragMode.NONE];
  const DragIcon = dragMeta.icon;

  // 도구 토글 버튼 -- 켜져 있을 때 액센트로 확실히 구분되게 한다.
  /*
    좁은 레일에서 '채우기'가 두 줄로 접히면서 버튼 높이가 옆 버튼과 어긋났다.
    글자폭을 추정해 패딩을 맞추는 건 폰트/OS마다 달라져 깨지기 쉬우므로,
    줄바꿈을 막고 높이를 고정해 어떤 환경에서도 두 버튼이 같은 크기가 되게 한다.
  */
  const toolToggleClass = (active: boolean) =>
    `h-9 px-1.5 whitespace-nowrap ${active ? "!bg-accent !text-accent-fg !border-accent shadow-sm" : ""}`;

  return (
    <PanelShell
      title="색칠하기"
      actions={
        <SegmentedControl
          options={FORMAT_OPTIONS}
          value={colorFormat}
          onChange={setColorFormat}
          label="색상 포맷"
        />
      }
    >
      <div className="relative h-full min-h-0 flex flex-col gap-2.5">
        {/*
          위: 작업 영역(색 고르기 | 칠하기), 아래: 상태 바.
          상태(드래그/커서/선택됨)를 오른쪽 세로 스택에 두었더니 패널 높이를 넘겨 잘렸다.
          상태는 "읽기만 하는 정보"라 가로 한 줄이면 충분하고, 그만큼 위쪽 컨트롤에 높이를 넘겨준다.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_11rem] gap-3.5 flex-1 min-h-0">

          {/* ===== 왼쪽: 색 고르기 ===== */}
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3.5 min-h-0">
            {/* 채도/명도 + 색조 피커 */}
            <RgbColorPicker color={currentColor} onChange={setCurrentColor} className="min-h-0" />

            {/* 수치 입력 + 최근 색상 */}
            <div className="flex flex-col min-h-0">
              {colorFormat === 'RGB' ? (
                <div className="flex flex-col gap-2.5">
                  {RGB_CHANNELS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <label htmlFor={`rgb-${key}`} className="text-[11px] font-semibold tracking-wider text-content-muted">
                          {label}
                        </label>
                        <input
                          id={`rgb-${key}`}
                          type="number"
                          aria-label={`${label} 값`}
                          className="w-11 text-right text-sm font-semibold tabular-nums bg-transparent text-content focus-ring rounded-sm"
                          min={0}
                          max={255}
                          value={rgbDraft[key]}
                          onChange={handleRgbFieldChange(key)}
                          onFocus={handleRgbFieldFocus(key)}
                          onBlur={handleRgbFieldBlur(key)}
                        />
                      </div>
                      <input
                        type="range"
                        aria-label={`${label} 슬라이더`}
                        min={0}
                        max={255}
                        value={currentColor[key]}
                        onChange={handleChannelSlide(key)}
                        className="channel-slider focus-ring"
                        style={{ background: CHANNEL_TRACK[key] }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="hex-input" className="text-[11px] font-semibold tracking-wider text-content-muted">
                    HEX
                  </label>
                  <ColorInput
                    id="hex-input"
                    color={hexLabel}
                    onChange={(value) => setCurrentColor(rgbaToRgb(hexToRgba(value)))}
                    onBlur={() => setIsHexInvalid(false)}
                    escape={hexEscape}
                    validate={validateHex}
                    format={hexFormat}
                    process={hexProcess}
                    placeholder="#3A7676"
                    className={`w-full bg-surface-solid border rounded-lg py-2 px-3 text-sm font-semibold tracking-widest tabular-nums text-content placeholder:text-content-subtle focus-ring transition-colors ${isHexInvalid ? 'border-danger' : 'border-border'}`}
                  />
                  <p className={`text-[11px] ${isHexInvalid ? 'text-danger' : 'text-content-muted'}`}>
                    {isHexInvalid ? '올바른 형식이 아닙니다.' : '6자리 16진수로 입력하세요.'}
                  </p>
                </div>
              )}

              {/*
                최근 색상. 스와치를 8칸 고정 그리드에 담아 개수가 늘어도 줄바꿈이 생기지 않게 하고,
                빈 칸은 아주 옅은 면으로만 남겨 "여기가 채워질 자리"임을 알리되 점선처럼 시끄럽지 않게 한다.
              */}
              <div className="flex flex-col gap-1 mt-auto pt-2.5">
                <span className="text-[11px] font-semibold tracking-wider text-content-muted">최근 색상</span>
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: RECENT_COLOR_LIMIT }).map((_, index) => {
                    const color = recentColors[index];

                    if (!color) {
                      return <span key={`empty-${index}`} className="aspect-square rounded-md bg-surface-hover" aria-hidden />;
                    }

                    return (
                      <button
                        key={`${color.r}-${color.g}-${color.b}-${index}`}
                        type="button"
                        onClick={() => setCurrentColor(color)}
                        title={`rgb(${color.r}, ${color.g}, ${color.b})`}
                        aria-label={`최근 색상 rgb(${color.r}, ${color.g}, ${color.b})`}
                        className={`focus-ring aspect-square rounded-md transition-transform hover:scale-115 hover:cursor-pointer ${isLightColor(color) ? 'ring-1 ring-inset ring-border-strong' : ''}`}
                        style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ===== 오른쪽: 칠하기 ===== */}
          <div className="flex flex-col gap-2 min-h-0 pl-3.5 border-l border-border">

            {/*
              현재 색상. 색 면과 값을 따로 쌓으면 두 줄을 먹어서, 색 위에 HEX를 얹어 한 줄로 합쳤다.
              글자색은 배경 밝기에 따라 뒤집어 어떤 색에서도 읽히게 한다.
            */}
            <div
              className="flex items-center justify-between gap-2 h-10 shrink-0 rounded-lg border border-border px-2.5"
              style={{ backgroundColor: colorCss }}
              title={`rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`}
            >
              <span className={`text-[11px] font-medium ${swatchTextClass}`}>현재 색상</span>
              <span className={`text-xs font-semibold tabular-nums tracking-wider ${swatchTextClass}`}>{hexLabel}</span>
            </div>

            {/* 주요 동작 */}
            <Button
              display={isPaintPending ? '칠하는 중...' : hasSelection ? `${selectedPixels.length}개 칠하기` : '칠하기'}
              hint="선택된 픽셀을 칠합니다."
              keybind="Enter"
              callback={handlePaintPixels}
              disabled={isPaintDisabled}
              fullWidth
              className="py-2"
            />

            {/* 보조 도구 */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                className={toolToggleClass(isCloneColorActive)}
                variant="subtle"
                fullWidth
                hint="캔버스의 색을 추출합니다."
                keybind="C"
                callback={() => setIsCloneColorActive(!isCloneColorActive)}
              >
                <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                  <Pipette className="w-4 h-4 shrink-0" />
                  <span className="text-[11px]">추출</span>
                </span>
              </Button>
              <Button
                className={toolToggleClass(isPaintBucketActive)}
                variant="subtle"
                fullWidth
                hint={`주변 픽셀 최대 ${BFS_LIMIT}개를 ${dragMode === DragMode.CANCEL ? "취소" : "선택"}합니다.`}
                keybind="F"
                callback={() => setIsPaintBucketActive(!isPaintBucketActive)}
              >
                <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                  <PaintBucket className="w-4 h-4 shrink-0" />
                  <span className="text-[11px]">채우기</span>
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/*
          상태 줄. 카드(배경+테두리+3줄)로 두면 그것만 60px 가까이 먹어서,
          구분선 하나 위의 한 줄로 낮췄다. 값은 라벨보다 굵게 둬 읽는 순서는 유지한다.
        */}
        <div className="flex items-center gap-4 shrink-0 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-content-muted shrink-0">드래그</span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${dragMeta.tone}`}>
              <DragIcon className="w-3 h-3 shrink-0" />
              {dragMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-content-muted shrink-0">커서</span>
            <span className="text-[11px] font-semibold tabular-nums text-content whitespace-nowrap">
              {cursorPosition.x}, {cursorPosition.y}
            </span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-content-muted shrink-0">선택됨</span>
            <span className={`text-[11px] font-semibold tabular-nums ${hasSelection ? 'text-accent' : 'text-content-subtle'}`}>
              {selectedPixels.length}
            </span>
          </div>

          {/* 선택 해제는 자주 쓰는데 그동안 캔버스에서만 가능했다. */}
          {hasSelection ? (
            <button
              type="button"
              onClick={() => setSelectedPixels([])}
              className="focus-ring ml-auto shrink-0 text-[11px] font-medium text-content-muted hover:text-danger transition-colors cursor-pointer"
            >
              선택 해제
            </button>
          ) : null}
        </div>

        {!accessToken ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface-solid/90 backdrop-blur-sm">
            <LoginGate message="로그인 후 이용하실 수 있습니다." onGoToLogin={() => setActiveTool(Tool.PROFILE)} />
          </div>
        ) : null}
      </div>
    </PanelShell>
  )
}
