import { useEffect, useState, useRef } from "react";
import { useNotification } from "../../contexts/Notification.context"

export const Notification = () => {
  const { title, content } = useNotification();

  // 실제로 화면에 표시되는 내용
  const [displayTitle, setDisplayTitle] = useState("");
  const [displayContent, setDisplayContent] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const isShowingRef = useRef(false);
  const queuedNotificationRef = useRef<{title: string, content: string} | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const prevNotificationRef = useRef({ title: "", content: "" });

  const showNotification = (newTitle: string, newContent: string) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    setDisplayTitle(newTitle);
    setDisplayContent(newContent);

    setIsVisible(true);
    isShowingRef.current = true;

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      isShowingRef.current = false;

      setTimeout(() => {
        if (queuedNotificationRef.current) {
          const queued = queuedNotificationRef.current;
          queuedNotificationRef.current = null;
          showNotification(queued.title, queued.content);
        }
      }, 300);
    }, 5000);
  };

  useEffect(() => {
    if (!title && !content) return;

    if (prevNotificationRef.current.title === title &&
        prevNotificationRef.current.content === content) {
      return;
    }

    prevNotificationRef.current = { title, content };

    if (isShowingRef.current) {
      queuedNotificationRef.current = { title, content };

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      setIsVisible(false);
      isShowingRef.current = false;

      setTimeout(() => {
        if (queuedNotificationRef.current) {
          const queued = queuedNotificationRef.current;
          queuedNotificationRef.current = null;
          showNotification(queued.title, queued.content);
        }
      }, 300);
    } else {
      showNotification(title, content);
    }
  }, [title, content]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`w-full max-w-full h-12 mb-2 bg-primary-modal backdrop-blur-sm rounded-md border border-primary-border shadow-xs flex flex-row items-center px-4 transition-opacity duration-300 ${
        !displayTitle && !displayContent
          ? 'opacity-0 pointer-events-none'
          : isVisible
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
      }`}
    >
      <span className="font-semibold">{displayTitle}:</span>
      <span className="text-sm ml-2">{displayContent}</span>
    </div>
  )
}