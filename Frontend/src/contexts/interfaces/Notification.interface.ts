import { Type } from "../enums/Type.enum";

export interface NotificationContextType {
  title: string,
  setTitle: (title: string) => void,

  content: string,
  setContent: (content: string) => void,

  type: Type,
  setType: (type: Type) => void,
}