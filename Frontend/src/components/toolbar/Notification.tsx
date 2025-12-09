import { useEffect, useState, useRef } from "react";
import { useNotification } from "../../contexts/Notification.context"
import { Notification } from "../../contexts/interfaces/Notification.interface";
import { Type } from "../../contexts/enums/Type.enum";

export const Feedback = () => {
  const { notification } = useNotification();

  // 실제로 화면에 표시되는 내용
  const [isVisible, setIsVisible] = useState(false);
  const isShowingRef = useRef(false);
  const prevNotificationRef = useRef<Notification | null>(null);
  const [displayNotification, setDisplayNotification] = useState<Notification | null>(null);
  const queuedNotificationRef = useRef<Notification | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const showNotification = (newNotification: Notification) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    setDisplayNotification(newNotification);

    setIsVisible(true);
    isShowingRef.current = true;

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      isShowingRef.current = false;

      setTimeout(() => {
        if (queuedNotificationRef.current) {
          const queued = queuedNotificationRef.current;
          queuedNotificationRef.current = null;
          showNotification(queued);
        }
      }, 300);
    }, 5000);
  };

  useEffect(() => {
    if (!notification) return;

    prevNotificationRef.current = notification;

    if (isShowingRef.current) {
      queuedNotificationRef.current = notification;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      setIsVisible(false);
      isShowingRef.current = false;

      setTimeout(() => {
        if (queuedNotificationRef.current) {
          const queued = queuedNotificationRef.current;
          queuedNotificationRef.current = null;
          showNotification(queued);
        }
      }, 300);
    } else {
      showNotification(notification);
    }
  }, [notification]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`w-full max-w-full h-12 mb-2 backdrop-blur-sm rounded-md border border-primary-border shadow-xs flex flex-row items-center px-4 transition-opacity duration-300 
        ${displayNotification?.type === Type.WARNING ? "bg-yellow-100/75" : displayNotification?.type === Type.ERROR ? "bg-red-100/75" : "bg-primary-modal"}
        ${!displayNotification ? 'opacity-0 pointer-events-none' : isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <span className="font-semibold">{displayNotification?.title}:</span>
      <span className="text-sm ml-2">{displayNotification?.content}</span>
    </div>
  )
}