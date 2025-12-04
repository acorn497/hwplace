// 커스텀 라이브러리 -- Source : https://github.com/omgovich/react-colorful

import React, { useState, useEffect, useCallback, useRef, useMemo, JSX } from "react";

// ==================== TYPES ====================

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface RgbaColor extends RgbColor {
  a: number;
}

interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface ColorPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "color" | "onChange" | "onChangeCapture"> {
  color: RgbColor;
  onChange: (newColor: RgbColor) => void;
}

type ColorInputHTMLAttributes = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
>;

export interface ColorInputBaseProps extends ColorInputHTMLAttributes {
  color?: string;
  onChange?: (newColor: string) => void;
}

export interface Interaction {
  left: number;
  top: number;
}

// ==================== UTILITIES ====================

// clamp.ts
const clamp = (number: number, min = 0, max = 1): number => {
  return number > max ? max : number < min ? min : number;
};

// round.ts
const round = (number: number, digits = 0, base = Math.pow(10, digits)): number => {
  return Math.round(base * number) / base;
};

// compare.ts
const equalRgb = (first: RgbColor, second: RgbColor): boolean => {
  return first.r === second.r && first.g === second.g && first.b === second.b;
};

export const hexToHsva = (hex: string): HsvaColor => rgbaToHsva(hexToRgba(hex));

export const hexToRgba = (hex: string): RgbaColor => {
  if (hex[0] === "#") hex = hex.substring(1);

  if (hex.length < 6) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
      a: hex.length === 4 ? round(parseInt(hex[3] + hex[3], 16) / 255, 2) : 1,
    };
  }

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
    a: hex.length === 8 ? round(parseInt(hex.substring(6, 8), 16) / 255, 2) : 1,
  };
};

export const hsvaToHex = (hsva: HsvaColor): string => rgbaToHex(hsvaToRgba(hsva));

export const hsvaToRgba = ({ h, s, v, a }: HsvaColor): RgbaColor => {
  h = (h / 360) * 6;
  s = s / 100;
  v = v / 100;

  const hh = Math.floor(h),
    b = v * (1 - s),
    c = v * (1 - (h - hh) * s),
    d = v * (1 - (1 - h + hh) * s),
    module = hh % 6;

  return {
    r: round([v, c, b, b, d, v][module] * 255),
    g: round([d, v, v, c, b, b][module] * 255),
    b: round([b, b, d, v, v, c][module] * 255),
    a: round(a, 2),
  };
};

export const hsvaToRgbString = (hsva: HsvaColor): string => {
  const { r, g, b } = hsvaToRgba(hsva);
  return `rgb(${r}, ${g}, ${b})`;
};

export const hsvaToRgbaString = (hsva: HsvaColor): string => {
  const { r, g, b, a } = hsvaToRgba(hsva);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const rgbaStringToHsva = (rgbaString: string): HsvaColor => {
  const matcher = /rgba?\(?\s*(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
  const match = matcher.exec(rgbaString);

  if (!match) return { h: 0, s: 0, v: 0, a: 1 };

  return rgbaToHsva({
    r: Number(match[1]) / (match[2] ? 100 / 255 : 1),
    g: Number(match[3]) / (match[4] ? 100 / 255 : 1),
    b: Number(match[5]) / (match[6] ? 100 / 255 : 1),
    a: match[7] === undefined ? 1 : Number(match[7]) / (match[8] ? 100 : 1),
  });
};

export const rgbStringToHsva = rgbaStringToHsva;

const format = (number: number) => {
  const hex = number.toString(16);
  return hex.length < 2 ? "0" + hex : hex;
};

export const rgbaToHex = ({ r, g, b, a }: RgbaColor): string => {
  const alphaHex = a < 1 ? format(round(a * 255)) : "";
  return "#" + format(r) + format(g) + format(b) + alphaHex;
};

export const rgbaToHsva = ({ r, g, b, a }: RgbaColor): HsvaColor => {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);

  const hh = delta
    ? max === r
      ? (g - b) / delta
      : max === g
        ? 2 + (b - r) / delta
        : 4 + (r - g) / delta
    : 0;

  return {
    h: round(60 * (hh < 0 ? hh + 6 : hh)),
    s: round(max ? (delta / max) * 100 : 0),
    v: round((max / 255) * 100),
    a,
  };
};

export const roundHsva = (hsva: HsvaColor): HsvaColor => ({
  h: round(hsva.h),
  s: round(hsva.s),
  v: round(hsva.v),
  a: round(hsva.a, 2),
});

export const rgbaToRgb = ({ r, g, b }: RgbaColor): RgbColor => ({ r, g, b });

// validate.ts
const matcher = /^#?([0-9A-F]{3,8})$/i;

export const validHex = (value: string, alpha?: boolean): boolean => {
  const match = matcher.exec(value);
  const length = match ? match[1].length : 0;

  return (
    length === 3 ||
    length === 6 ||
    (!!alpha && length === 4) ||
    (!!alpha && length === 8)
  );
};

// ==================== HOOKS ====================

// useEventCallback
function useEventCallback<T>(handler?: (value: T) => void): (value: T) => void {
  const callbackRef = useRef(handler);
  const fn = useRef((value: T) => {
    callbackRef.current && callbackRef.current(value);
  });
  callbackRef.current = handler;

  return fn.current;
}

// useColorManipulation - RGB 전용
function useColorManipulation(
  color: RgbColor,
  onChange?: (color: RgbColor) => void
): [HsvaColor, (color: Partial<HsvaColor>) => void] {
  const onChangeCallback = useEventCallback<RgbColor>(onChange);
  const [hsva, updateHsva] = useState<HsvaColor>(() => rgbaToHsva({ ...color, a: 1 }));
  const cache = useRef({ color, hsva });

  useEffect(() => {
    if (!equalRgb(color, cache.current.color)) {
      const newHsva = rgbaToHsva({ ...color, a: 1 });
      cache.current = { hsva: newHsva, color };
      updateHsva(newHsva);
    }
  }, [color]);

  useEffect(() => {
    const newColor = rgbaToRgb(hsvaToRgba(hsva));
    if (!equalRgb(newColor, cache.current.color)) {
      cache.current = { hsva, color: newColor };
      onChangeCallback(newColor);
    }
  }, [hsva, onChangeCallback]);

  const handleChange = useCallback((params: Partial<HsvaColor>) => {
    updateHsva((current) => Object.assign({}, current, params));
  }, []);

  return [hsva, handleChange];
}

// ==================== COMPONENTS ====================

// Pointer
interface PointerProps {
  className?: string;
  top?: number;
  left: number;
  color: string;
}

const Pointer = ({ className, color, left, top = 0.5 }: PointerProps): JSX.Element => {
  const style = {
    top: `${top * 100}%`,
    left: `${left * 100}%`,
  };

  return (
    <div
      className={`absolute z-1 box-border w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-white border-3 border-white rounded-full ] ${className || ''}`}
      style={style}
    >
      <div
        className="absolute left-0 top-0 right-0 bottom-0 pointer-events-none rounded-[inherit]"
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

// Interactive
const isTouch = (event: MouseEvent | TouchEvent): event is TouchEvent => "touches" in event;

const getTouchPoint = (touches: TouchList, touchId: null | number): Touch => {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === touchId) return touches[i];
  }
  return touches[0];
};

const getParentWindow = (node?: HTMLDivElement | null): Window => {
  return (node && node.ownerDocument.defaultView) || self;
};

const getRelativePosition = (
  node: HTMLDivElement,
  event: MouseEvent | TouchEvent,
  touchId: null | number
): Interaction => {
  const rect = node.getBoundingClientRect();
  const pointer = isTouch(event) ? getTouchPoint(event.touches, touchId) : (event as MouseEvent);

  return {
    left: clamp((pointer.pageX - (rect.left + getParentWindow(node).pageXOffset)) / rect.width),
    top: clamp((pointer.pageY - (rect.top + getParentWindow(node).pageYOffset)) / rect.height),
  };
};

const preventDefaultMove = (event: MouseEvent | TouchEvent): void => {
  !isTouch(event) && event.preventDefault();
};

const isInvalid = (event: MouseEvent | TouchEvent, hasTouch: boolean): boolean => {
  return hasTouch && !isTouch(event);
};

interface InteractiveProps {
  onMove: (interaction: Interaction) => void;
  onKey: (offset: Interaction) => void;
  children: React.ReactNode;
}

const InteractiveBase = ({ onMove, onKey, ...rest }: InteractiveProps) => {
  const container = useRef<HTMLDivElement>(null);
  const onMoveCallback = useEventCallback<Interaction>(onMove);
  const onKeyCallback = useEventCallback<Interaction>(onKey);
  const touchId = useRef<null | number>(null);
  const hasTouch = useRef(false);

  const [handleMoveStart, handleKeyDown, toggleDocumentEvents] = useMemo(() => {
    const handleMoveStart = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
      const el = container.current;
      if (!el) return;

      preventDefaultMove(nativeEvent);

      if (isInvalid(nativeEvent, hasTouch.current) || !el) return;

      if (isTouch(nativeEvent)) {
        hasTouch.current = true;
        const changedTouches = nativeEvent.changedTouches || [];
        if (changedTouches.length) touchId.current = changedTouches[0].identifier;
      }

      el.focus();
      onMoveCallback(getRelativePosition(el, nativeEvent, touchId.current));
      toggleDocumentEvents(true);
    };

    const handleMove = (event: MouseEvent | TouchEvent) => {
      preventDefaultMove(event);

      const isDown = isTouch(event) ? event.touches.length > 0 : event.buttons > 0;

      if (isDown && container.current) {
        onMoveCallback(getRelativePosition(container.current, event, touchId.current));
      } else {
        toggleDocumentEvents(false);
      }
    };

    const handleMoveEnd = () => toggleDocumentEvents(false);

    const handleKeyDown = (event: React.KeyboardEvent) => {
      const keyCode = event.which || event.keyCode;

      if (keyCode < 37 || keyCode > 40) return;
      event.preventDefault();
      onKeyCallback({
        left: keyCode === 39 ? 0.05 : keyCode === 37 ? -0.05 : 0,
        top: keyCode === 40 ? 0.05 : keyCode === 38 ? -0.05 : 0,
      });
    };

    function toggleDocumentEvents(state?: boolean) {
      const touch = hasTouch.current;
      const el = container.current;
      const parentWindow = getParentWindow(el);

      const toggleEvent = state ? parentWindow.addEventListener : parentWindow.removeEventListener;
      toggleEvent(touch ? "touchmove" : "mousemove", handleMove);
      toggleEvent(touch ? "touchend" : "mouseup", handleMoveEnd);
    }

    return [handleMoveStart, handleKeyDown, toggleDocumentEvents];
  }, [onKeyCallback, onMoveCallback]);

  useEffect(() => toggleDocumentEvents, [toggleDocumentEvents]);

  return (
    <div
      {...rest}
      onTouchStart={handleMoveStart}
      onMouseDown={handleMoveStart}
      className="absolute left-0 top-0 right-0 bottom-0 rounded-[inherit] outline-none touch-none"
      ref={container}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
    />
  );
};

const Interactive = React.memo(InteractiveBase);

// Saturation
interface SaturationProps {
  hsva: HsvaColor;
  onChange: (newColor: { s: number; v: number }) => void;
}

const SaturationBase = ({ hsva, onChange }: SaturationProps) => {
  const handleMove = (interaction: Interaction) => {
    onChange({
      s: interaction.left * 100,
      v: 100 - interaction.top * 100,
    });
  };

  const handleKey = (offset: Interaction) => {
    onChange({
      s: clamp(hsva.s + offset.left * 100, 0, 100),
      v: clamp(hsva.v - offset.top * 100, 0, 100),
    });
  };

  const containerStyle = {
    backgroundColor: hsvaToRgbString({ h: hsva.h, s: 100, v: 100, a: 1 }),
    backgroundImage: 'linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, rgba(255, 255, 255, 0))',
  };

  return (
    <div
      className="relative grow border-transparent rounded-md border-b-8 border-b-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
      style={containerStyle}
    >
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Color"
        aria-valuetext={`Saturation ${round(hsva.s)}%, Brightness ${round(hsva.v)}%`}
      >
        <Pointer
          className="z-3"
          top={1 - hsva.v / 100}
          left={hsva.s / 100}
          color={hsvaToRgbString(hsva)}
        />
      </Interactive>
    </div>
  );
};

const Saturation = React.memo(SaturationBase);

// 하단 수평 루트 색상 선택기
interface HueProps {
  className?: string;
  hue: number;
  onChange: (newHue: { h: number }) => void;
}

const HueBase = ({ className, hue, onChange }: HueProps) => {
  const handleMove = (interaction: Interaction) => {
    onChange({ h: 360 * interaction.left });
  };

  const handleKey = (offset: Interaction) => {
    onChange({
      h: clamp(hue + offset.left * 360, 0, 360),
    });
  };

  return (
    <div
      className={`relative h-3 mt-1 rounded-full ${className || ''}`}
      style={{
        background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
      }}
    >
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Hue"
        aria-valuenow={round(hue)}
        aria-valuemax="360"
        aria-valuemin="0"
      >
        <Pointer
          className="z-2"
          left={hue / 360}
          color={hsvaToRgbString({ h: hue, s: 100, v: 100, a: 1 })}
        />
      </Interactive>
    </div>
  );
};

const Hue = React.memo(HueBase);

// ColorInput
interface ColorInputProps extends ColorInputBaseProps {
  escape: (value: string) => string;
  validate: (value: string) => boolean;
  format?: (value: string) => string;
  process?: (value: string) => string;
}

export const ColorInput = (props: ColorInputProps): JSX.Element => {
  const { color = "", onChange, onBlur, escape, validate, format, process, ...rest } = props;
  const [value, setValue] = useState(() => escape(color));
  const onChangeCallback = useEventCallback<string>(onChange);
  const onBlurCallback = useEventCallback<React.FocusEvent<HTMLInputElement>>(onBlur);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = escape(e.target.value);
      setValue(inputValue);
      if (validate(inputValue)) onChangeCallback(process ? process(inputValue) : inputValue);
    },
    [escape, process, validate, onChangeCallback]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!validate(e.target.value)) setValue(escape(color));
      onBlurCallback(e);
    },
    [color, escape, validate, onBlurCallback]
  );

  useEffect(() => {
    setValue(escape(color));
  }, [color, escape]);

  return (
    <input
      {...rest}
      value={format ? format(value) : value}
      spellCheck="false"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

// ==================== EXPORTED COLOR PICKERS ====================

export const RgbColorPicker = ({
  className,
  color = { r: 0, g: 0, b: 0 },
  onChange,
  ...rest
}: Partial<ColorPickerProps>): JSX.Element => {
  const [hsva, updateHsva] = useColorManipulation(color, onChange);

  return (
    <div {...rest} className={`relative flex flex-col w-55 h-26 select-none cursor-default overflow-hidden ${className || ''}`}>
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} />
    </div>
  );
};