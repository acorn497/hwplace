import { Info, CircleCheck, CircleAlert, CircleX } from 'lucide-react';
import { useEffect, useState } from 'react';

const icons = {
  INFO: Info,
  OK: CircleCheck,
  WARN: CircleAlert,
  ERROR: CircleX,
}

export enum types {
  INFO = "INFO",
  OK = "OK",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface NotificationProps {
  title?: string,
  content?: string,
  method?: types,
  callback: () => void,
  duration?: number,
}

export default function Notification({ title, content, method = types.INFO, callback, duration = 20 }: NotificationProps) {
  const [timer, setTimer] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setFadeIn(true), 250);
    return () => { clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (timer == duration) {
      setFadeOut(true);
    }
  }, [timer]);

  useEffect(() => {
    if (!fadeOut) return;
    const timeout = setTimeout(callback, 1000);
    return () => clearTimeout(timeout);
  }, [fadeOut]);

  function handleOnMouseEnter() {
    setHovering(true);
    setTimer(0);
  }

  function handleOnMouseLeave() {
    setHovering(false);
  }

  useEffect(() => {
    if (hovering) return;
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [hovering])

  const Icon = icons[method];

  return (
    <div className={`max-w-200 bg-bg-primary backdrop-blur-md fixed left-1/2 -translate-x-1/2 translate-y-1/2 rounded-lg border border-border-primary grid grid-cols-[30px_1fr] items-center px-2.5 transition-[opacity, transform] duration-500 ${fadeIn ? "min-w-150 min-h-10 bottom-50" : "min-w-149 min-h-8.5 bottom-48"} ${fadeOut ? "opacity-0" : fadeIn ? "opacity-100" : "opacity-0"}`} onMouseEnter={() => handleOnMouseEnter()} onMouseLeave={() => handleOnMouseLeave()} >
      <Icon className={`
        h-5 w-5
        ${method === types.INFO ? "text-blue-300" : ""} 
        ${method === types.OK ? "text-green-300" : ""} 
        ${method === types.WARN ? "text-yellow-300" : ""} 
        ${method === types.ERROR ? "text-red-300" : ""} `}
      />
      <div className='left-10'>
        <span className='font-semibold'>{title}</span><span className='text-sm font-medium'>: {content}</span>
      </div>
    </div>
  )
}