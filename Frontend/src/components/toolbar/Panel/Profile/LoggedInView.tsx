import { useState } from "react";
import { Titlebox } from "../../../common/Titlebox";
import { Button } from "../../../common/Button";
import { useAuth } from "../../../../contexts/Auth.context";

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
      console.error("Failed to copy token:", err);
    }
  };

  const getMaskedToken = (token: string) => {
    if (token.length <= 12) return token;
    return `${token.substring(0, 5)}...........${token.substring(token.length - 3)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 프로필 정보 섹션 */}
      <div className="flex flex-col gap-2">
        {/* 사용자명 */}
        <Titlebox title="USERNAME">
          <span className="text-sm font-medium text-slate-800">{username}</span>
        </Titlebox>

        {/* 이메일 */}
        <Titlebox title="EMAIL">
          <span className="text-sm text-slate-600 truncate">{email}</span>
        </Titlebox>

        {/* 토큰 */}
        <Titlebox title="ACCESS TOKEN">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-mono text-slate-500 truncate">
              {getMaskedToken(accessToken)}
            </span>
            <button
              onClick={handleCopyToken}
              className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors shrink-0"
              style={{
                backgroundColor: copied ? '#06b6d4' : '#e2e8f0',
                color: copied ? 'white' : '#64748b'
              }}
            >
              {copied ? '✓' : '복사'}
            </button>
            <Button display={copied ? '✓' : 'Copy'} hint="토큰을 클립보드에 복사합니다." />
          </div>
        </Titlebox>
      </div>

      {/* 로그아웃 버튼 */}
      <button
        onClick={handleLogout}
        className="w-full py-2.5 px-4 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 active:bg-cyan-700 transition-colors shadow-sm hover:shadow-md"
      >
        로그아웃
      </button>
    </div>
  );
};
