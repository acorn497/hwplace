import { Type } from "../enums/Type.enum";

export interface Notification {
  title: string,
  content: string,
  type?: Type,
}

export interface NotificationContextType {
  notification: Notification | null | undefined,
  setNotification: React.Dispatch<React.SetStateAction<Notification | null | undefined>>,
}