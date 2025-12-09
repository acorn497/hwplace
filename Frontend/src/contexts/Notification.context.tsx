import { createContext, ReactNode, useContext, useState } from "react";
import { Type } from "./enums/Type.enum";
import { NotificationContextType } from "./interfaces/Notification.interface";



const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<Type>(Type.NORMAL);

  const value: NotificationContextType = {
    title, setTitle,
    content, setContent,
    type, setType
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalVariable이 GlobalVariableProvider 외부에서 호출되었습니다.');
  }
  return context;
}