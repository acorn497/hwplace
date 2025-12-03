import { useEffect } from "react"

export const useKeyboardShortcut = (keybind: string, callback: () => void) => {
  useEffect(() => {
    const formattedKeybind = keybind.replaceAll(' ', '').toUpperCase();
    const keys = formattedKeybind.split('+');
    const mainKey = keys[keys.length - 1]; // 마지막 키가 메인 키
    const modifiers = keys.slice(0, -1); // 나머지가 modifier keys

    const handleKeyboardShortcut = ((event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable)
        return;

      // modifier key들이 mainKey인 경우
      const pressedKey = event.key.toUpperCase();
      const isShiftPressed = pressedKey === 'SHIFT' || event.shiftKey;
      const isCtrlPressed = pressedKey === 'CONTROL' || event.ctrlKey || event.metaKey;
      const isAltPressed = pressedKey === 'ALT' || event.altKey;

      // mainKey 체크
      let mainKeyMatches = false;
      if (mainKey === 'SHIFT' && pressedKey === 'SHIFT') mainKeyMatches = true;
      else if (mainKey === 'CTRL' && (pressedKey === 'CONTROL' || pressedKey === 'META')) mainKeyMatches = true;
      else if (mainKey === 'ALT' && pressedKey === 'ALT') mainKeyMatches = true;
      else if (pressedKey === mainKey) mainKeyMatches = true;

      if (!mainKeyMatches) return;

      // modifier 체크
      const needsShift = modifiers.includes('SHIFT');
      const needsCtrl = modifiers.includes('CTRL');
      const needsAlt = modifiers.includes('ALT');

      // modifier가 있는 경우
      if (modifiers.length > 0) {
        if (needsShift && !isShiftPressed) return;
        if (needsCtrl && !isCtrlPressed) return;
        if (needsAlt && !isAltPressed) return;

        // 필요하지 않은 modifier가 눌려있으면 안됨
        if (!needsShift && isShiftPressed && mainKey !== 'SHIFT') return;
        if (!needsCtrl && isCtrlPressed && mainKey !== 'CTRL') return;
        if (!needsAlt && isAltPressed && mainKey !== 'ALT') return;
      } else {
        // modifier가 없는 경우: mainKey가 modifier가 아니라면 다른 modifier가 눌려있으면 안됨
        if (mainKey !== 'SHIFT' && mainKey !== 'CTRL' && mainKey !== 'ALT') {
          if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        }
      }

      event.preventDefault();
      callback();
    });

    document.addEventListener("keydown", handleKeyboardShortcut);
    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcut);
    }
  }, [keybind, callback]);
}