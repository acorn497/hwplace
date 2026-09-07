import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { useNotification } from "../../contexts/Notification.context"
import { Notification } from "../../contexts/interfaces/Notification.interface";
import { Type } from "../../contexts/enums/Type.enum";
import { useGlobalVariable } from "../../contexts/GlobalVariable.context";
import { PanelPosition } from "../../contexts/enums/PanelPosition.enum";

// ms
const HOLD_TTL = 5000;
const FADE_TTL = 300;

// 타입별 배경/텍스트/아이콘 - 세 배경 모두에서 충분한 대비를 갖도록 텍스트 색을 함께 지정한다.
const TYPE_STYLES: Record<Type, { bg: string, text: string, Icon: typeof Info }> = {
  [Type.NORMAL]: { bg: "bg-surface", text: "text-content", Icon: Info },
  [Type.WARNING]: { bg: "bg-warn-surface", text: "text-warn", Icon: AlertTriangle },
  [Type.ERROR]: { bg: "bg-danger-surface", text: "text-danger", Icon: XCircle },
};

const POSITION_CLASSES: Record<PanelPosition, string> = {
  [PanelPosition.TL]: "top-full mt-2",
  [PanelPosition.TR]: "top-full mt-2",
  [PanelPosition.BL]: "-top-[20%] mb-2",
  [PanelPosition.BR]: "-top-[20%] mb-2",
  [PanelPosition.BC]: "-top-[20%] mb-2",
};

export const Feedback = () => {
  const { notification } = useNotification();
  const { panelPosition } = useGlobalVariable();

  const [displayNotification, setDisplayNotification] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isShowingRef = useRef(false);
  const queuedRef = useRef<Notification | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  // 큐에 대기 중인 알림이 있으면 페이드가 끝난 뒤 이어서 보여준다.
  const scheduleAdvance = () => {
    advanceTimerRef.current = window.setTimeout(() => {
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (queued) presentNotification(queued);
    }, FADE_TTL);
  };

  // 알림을 화면에 표시하고 HOLD_TTL 이후 자동으로 숨긴다.
  const presentNotification = (next: Notification) => {
    setDisplayNotification(next);
    setIsVisible(true);
    isShowingRef.current = true;

    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      isShowingRef.current = false;
      scheduleAdvance();
    }, HOLD_TTL);
  };

  useEffect(() => {
    if (!notification) return;

    clearTimers();

    if (isShowingRef.current) {
      // 이미 다른 알림이 표시 중이면 큐에 저장하고, 지금 보이는 알림을 먼저 숨긴다.
      queuedRef.current = notification;
      setIsVisible(false);
      isShowingRef.current = false;
      scheduleAdvance();
    } else {
      presentNotification(notification);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification]);

  useEffect(() => clearTimers, []);

  const { bg, text, Icon } = TYPE_STYLES[displayNotification?.type ?? Type.NORMAL];
  const position = POSITION_CLASSES[panelPosition] ?? POSITION_CLASSES[PanelPosition.BC];

  return (
    <div
      role="status"
      className={`absolute ${position} w-full max-w-full h-12 backdrop-blur-sm rounded-md border border-border shadow-xs flex flex-row items-center gap-2 px-4 transition-opacity duration-300
        ${bg} ${text}
        ${!displayNotification ? 'opacity-0 pointer-events-none' : isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {displayNotification ? <Icon className="w-4 h-4 shrink-0" /> : null}
      <span className="font-semibold">{displayNotification?.title}:</span>
      <span className="text-sm">{displayNotification?.content}</span>
    </div>
  )
}
