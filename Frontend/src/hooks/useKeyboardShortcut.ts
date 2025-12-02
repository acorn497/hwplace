import { useEffect } from "react"

export const useKeyboardShortcut = (keybind: string, callback: () => void) => {
  useEffect(() => {
    const isMultipleKeybind = keybind.includes('+');
    const formattedKeybind = keybind.replaceAll(' ', '').toUpperCase();

    const mainKey = (isMultipleKeybind ? formattedKeybind.split('+')[1] : formattedKeybind);
    const subKey = isMultipleKeybind ? formattedKeybind.split('+')[0] : "NONE";

    const handleKeyboardShortcut = ((event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable)
        return;

      if (event.key.toUpperCase() !== mainKey) return;
      switch (subKey) {
        case "SHIFT":
          if (!event.shiftKey) return;
          event.preventDefault()
          callback()
          break;
        case "CTRL":
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault()
          callback()
          break;
        case "ALT":
          if (!event.altKey) return;
          event.preventDefault()
          callback()
          break;
        case "NONE":
          if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
          event.preventDefault()
          callback()
          break;
      }
    });

    document.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcut);
    }
  }, [keybind, callback]);
}