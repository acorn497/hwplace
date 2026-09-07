import { useState } from "react";
import { Titlebox } from "../../../common/Titlebox";
import { Button } from "../../../common/Button";
import { useAuth } from "../../../../contexts/Auth.context";
import { PanelSection } from "../../../common/PanelKit";

export const LoggedInView = () => {
  const { username, email, accessToken, setAccessToken, setUsername, setEmail } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleLogout = () => {
    setAccessToken("");
    setUsername("");
    setEmail("");
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("토큰 복사에 실패했습니다:", err);
    }
  };

  const getMaskedToken = (token: string) => {
    if (token.length <= 12) return token;
    return `${token.substring(0, 5)}...........${token.substring(token.length - 3)}`;
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <PanelSection>
        <div className="flex flex-col gap-2">
          <Titlebox title="USERNAME">
            <span className="text-sm font-medium text-content">{username}</span>
          </Titlebox>

          <Titlebox title="EMAIL">
            <span className="text-sm text-content-muted truncate">{email}</span>
          </Titlebox>

          <Titlebox title="ACCESS TOKEN">
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-mono text-content-subtle truncate">
                {getMaskedToken(accessToken)}
              </span>
              <Button
                display={copied ? '✓' : '복사'}
                variant="subtle"
                className="text-xs shrink-0"
                hint="토큰을 클립보드에 복사합니다."
                callback={handleCopyToken}
              />
            </div>
          </Titlebox>
        </div>
      </PanelSection>

      {/* 로그아웃은 위험 동작이 아니므로 액센트와 구분되는 중립 톤 사용 */}
      <button
        type="button"
        onClick={handleLogout}
        className="focus-ring mt-auto w-full py-2.5 px-4 bg-surface-hover text-content text-sm font-medium rounded-lg border border-border hover:bg-surface-raised active:bg-border-strong transition-colors shadow-sm cursor-pointer"
      >
        로그아웃
      </button>
    </div>
  );
};
