export interface ChatMessage {
  message: string;
  sender: string;
  timestamp: string; // ISO date string
  isMine: boolean;
}

export interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (message: string) => void;

  unreadCount: number;
  clearUnread: () => void;

  /** 저장된 대화 기록을 지운다 */
  clearHistory: () => void;
}
