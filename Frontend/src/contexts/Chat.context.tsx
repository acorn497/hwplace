import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useSocket } from "./Socket.context";
import { useAuth } from "./Auth.context";
import { ChatContextType, ChatMessage } from "./interfaces/Chat.interface";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// 채팅 내역 최대 보관 개수
const MAX_HISTORY = 200;

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const { socket } = useSocket();
  const { username, accessToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // 이벤트 콜백 내부에서 최신 username을 참조하기 위한 ref
  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    if (!socket) return;

    // 이벤트 리스너 등록
    socket.on('receive-message', (data: { message: string; sender: string; timestamp: string }) => {
      const isMine = data.sender === usernameRef.current;

      setMessages((prevMessages) => {
        const newMessages = [
          ...prevMessages,
          { message: data.message, sender: data.sender, timestamp: data.timestamp, isMine },
        ];
        // 최대 보관 개수를 넘으면 오래된 메시지부터 제거
        if (newMessages.length > MAX_HISTORY) {
          return newMessages.slice(newMessages.length - MAX_HISTORY);
        }
        return newMessages;
      });

      // 내가 보낸 메시지는 안 읽은 메시지로 세지 않음
      if (!isMine) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // 클린업: 이벤트 리스너 해제
    return () => {
      socket.off('receive-message');
    };
  }, [socket]);

  const sendMessage = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!socket || !accessToken) return;

    socket.emit('send-message', { message: trimmed, sender: username });
  };

  const clearUnread = () => {
    setUnreadCount(0);
  };

  const value: ChatContextType = {
    messages,
    sendMessage,
    unreadCount,
    clearUnread,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat이 ChatProvider 외부에서 호출되었습니다.');
  }
  return context;
};
