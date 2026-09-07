import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useSocket } from "./Socket.context";
import { useAuth } from "./Auth.context";
import { ChatContextType, ChatMessage } from "./interfaces/Chat.interface";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// 채팅 내역 최대 보관 개수
const MAX_HISTORY = 200;

// 새로고침 후에도 대화가 남도록 localStorage에 보관한다.
// (서버가 지난 대화를 다시 내려주지 않으므로 클라이언트가 들고 있어야 한다)
const STORAGE_KEY = "chatHistory";

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") return false;
  const { message, sender, timestamp } = value as ChatMessage;
  return typeof message === "string" && typeof sender === "string" && typeof timestamp === "string";
};

const loadHistory = (): ChatMessage[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(isChatMessage).slice(-MAX_HISTORY);
  } catch {
    // 저장된 값이 깨졌으면 조용히 버린다 (대화 기록 때문에 앱이 죽으면 안 된다)
    return [];
  }
};

const saveHistory = (messages: ChatMessage[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // 용량 초과 등으로 실패해도 대화 자체는 계속되어야 한다
  }
};

/** 같은 메시지가 두 번 들어오는 것을 막는다 (재연결 시 서버가 되돌려주는 경우 대비) */
const isDuplicate = (list: ChatMessage[], next: ChatMessage) =>
  list.some(m => m.timestamp === next.timestamp && m.sender === next.sender && m.message === next.message);

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const { socket } = useSocket();
  const { username, accessToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // 이벤트 콜백 내부에서 최신 username을 참조하기 위한 ref
  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  /*
    isMine은 "지금 로그인한 계정" 기준의 값이라 저장했다가 그대로 복원하면
    다른 계정으로 로그인했을 때 남의 말풍선이 내 것으로 보인다.
    username이 정해지거나 바뀔 때마다 sender를 기준으로 다시 계산한다.
  */
  useEffect(() => {
    setMessages(prev => {
      let changed = false;
      const next = prev.map(m => {
        const isMine = m.sender === username;
        if (isMine === m.isMine) return m;
        changed = true;
        return { ...m, isMine };
      });
      return changed ? next : prev;
    });
  }, [username]);

  useEffect(() => {
    if (!socket) return;

    // 이벤트 리스너 등록
    socket.on('receive-message', (data: { message: string; sender: string; timestamp: string }) => {
      const isMine = data.sender === usernameRef.current;

      const incoming: ChatMessage = {
        message: data.message, sender: data.sender, timestamp: data.timestamp, isMine,
      };

      setMessages((prevMessages) => {
        if (isDuplicate(prevMessages, incoming)) return prevMessages;

        const newMessages = [...prevMessages, incoming];
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

  // 메시지가 바뀔 때마다 저장한다. (isMine은 로그인 계정에 따라 달라지므로 저장 후 복원 시 다시 계산된다)
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const sendMessage = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (!socket || !accessToken) return;

    socket.emit('send-message', { message: trimmed, sender: username });
  };

  const clearUnread = () => {
    setUnreadCount(0);
  };

  const clearHistory = () => {
    setMessages([]);
    setUnreadCount(0);
  };

  const value: ChatContextType = {
    messages,
    sendMessage,
    unreadCount,
    clearUnread,
    clearHistory,
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
