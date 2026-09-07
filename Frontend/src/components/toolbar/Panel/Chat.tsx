import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Send } from "lucide-react";
import { useAuth } from "../../../contexts/Auth.context";
import { useGlobalVariable } from "../../../contexts/GlobalVariable.context"
import { Tool } from "../../../contexts/enums/Tool.enum";
import { useChat } from "../../../contexts/Chat.context";
import { ChatMessage } from "../../../contexts/interfaces/Chat.interface";
import { PanelShell, LoginGate } from "../../common/PanelKit";

// 메시지 최대 입력 길이
const MAX_MESSAGE_LENGTH = 200;

/** 이 거리(px) 안이면 "맨 아래를 보고 있다"고 간주해 새 메시지를 따라 내려간다 */
const BOTTOM_THRESHOLD = 24;

// ISO 문자열을 HH:MM 형식으로 변환
const formatTime = (iso: string) => {
  const date = new Date(iso);
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

// 채팅 말풍선 하나
const ChatBubble = ({ message, showSender }: { message: ChatMessage, showSender: boolean }) => {
  const { message: text, sender, timestamp, isMine } = message;

  return (
    <div className={`flex flex-col min-w-0 ${isMine ? "items-end" : "items-start"}`}>
      {showSender ?
        <span className="text-xs text-content-muted px-1 mb-0.5 max-w-full truncate">{sender}</span>
        : null}
      <div className={`flex items-end gap-1.5 max-w-[85%] min-w-0 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
        <div className={`min-w-0 break-words whitespace-pre-wrap px-3 py-1.5 rounded-lg text-sm ${isMine ? "bg-accent text-accent-fg rounded-br-sm" : "bg-surface-solid border border-border text-content rounded-bl-sm"}`}>
          {text}
        </div>
        <span className="text-[10px] text-content-subtle shrink-0 pb-0.5">{formatTime(timestamp)}</span>
      </div>
    </div>
  );
};

export const Chat = () => {
  const { setActiveTool } = useGlobalVariable();
  const { accessToken } = useAuth();
  const { messages, sendMessage, clearUnread, clearHistory } = useChat();

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 채팅 패널이 보여지는 동안 안 읽은 메시지 수 초기화
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  /*
    새 메시지 도착 시 맨 아래로 따라가되, 사용자가 위로 올려 지난 대화를 보는 중이면 건드리지 않는다.
    (예전엔 무조건 내려서, 과거 기록을 읽는 도중 남이 채팅을 치면 강제로 끌려 내려갔다)
    "맨 아래에 있었는가"는 새 메시지가 그려지기 전에 판단해야 하므로 렌더 직전에 재는 layout effect를 쓴다.
  */
  const isPinnedToBottomRef = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  // 패널을 처음 열면 항상 최신 메시지가 보이도록 맨 아래에서 시작한다
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isPinnedToBottomRef.current = true;
    setHasNewBelow(false);
    // 최초 마운트 시 한 번만
  }, []);

  const measurePinned = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    // 소수점 오차와 줌 배율을 감안해 약간의 여유를 둔다
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isPinnedToBottomRef.current = distance <= BOTTOM_THRESHOLD;
    if (isPinnedToBottomRef.current) setHasNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    if (isPinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      // 위를 보고 있는 중이라면 위치를 유지하고, 새 소식이 있다는 것만 알린다
      setHasNewBelow(true);
    }
  }, [messages]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isPinnedToBottomRef.current = true;
    setHasNewBelow(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PanelShell
      title="채팅"
      actions={
        <>
          <span className="text-xs text-content-subtle">{messages.length}개의 메시지</span>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={clearHistory}
              title="저장된 대화 기록을 지웁니다"
              className="focus-ring rounded-md px-1.5 py-0.5 text-[11px] text-content-muted transition-colors hover:bg-surface-hover hover:text-danger cursor-pointer"
            >
              기록 지우기
            </button>
          ) : null}
        </>
      }
    >
      {/* pb-1: 입력창이 본문 맨 아래에 붙으면 포커스 링(outline-offset)이 잘려 보인다 */}
      <div className="flex flex-col gap-3 h-full min-h-0 pb-1">
        {/* 메시지 목록: 로그인 여부와 상관없이 항상 공개 */}
        <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={listRef}
          onScroll={measurePinned}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1"
          style={{ scrollbarColor: "var(--hw-border-strong) transparent" }}
        >
          {messages.length === 0 ?
            <div className="flex flex-1 flex-col justify-center items-center text-sm text-content-muted select-none">
              아직 대화가 없습니다.
            </div>
            : messages.map((message, index) => {
              const previous = messages[index - 1];
              const showSender = !previous || previous.sender !== message.sender || previous.isMine !== message.isMine;
              return <ChatBubble key={`${message.timestamp}-${index}`} message={message} showSender={showSender} />;
            })}
        </div>

        {/* 위를 보는 중에 새 메시지가 오면 강제로 내리지 않고 이 버튼으로 알린다 */}
        {hasNewBelow ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="focus-ring absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-fg shadow-md transition-colors hover:bg-accent-hover cursor-pointer"
          >
            <ChevronDown className="h-3 w-3" />
            새 메시지
          </button>
        ) : null}
        </div>

        {/* 입력 영역: 로그인한 사용자만 메시지 전송 가능 */}
        {accessToken ?
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="메시지를 입력하세요"
              className="focus-ring flex-1 min-w-0 h-9 px-3 bg-surface-solid border border-border rounded-lg text-sm text-content placeholder:text-content-subtle transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="메시지 보내기"
              className="focus-ring flex items-center justify-center w-9 h-9 shrink-0 bg-accent text-accent-fg rounded-lg hover:bg-accent-hover active:bg-accent-active disabled:bg-border-strong disabled:text-content-subtle disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          :
          <div className="shrink-0 pt-1">
            <LoginGate
              message="로그인 후 채팅에 참여할 수 있습니다."
              onGoToLogin={() => setActiveTool(Tool.PROFILE)}
            />
          </div>
        }
      </div>
    </PanelShell>
  )
}
