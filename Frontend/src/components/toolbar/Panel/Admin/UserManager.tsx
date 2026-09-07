import { useCallback, useEffect, useState } from "react";
import { Ban, Eraser, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { FetchMethod, apiFetch } from "../../../../hooks/useFetch";
import { useNotification } from "../../../../contexts/Notification.context";
import { Type } from "../../../../contexts/enums/Type.enum";
import { useAuth } from "../../../../contexts/Auth.context";

interface AdminUser {
  index: number;
  username: string;
  email: string;
  restricted: boolean;
  role: 'USER' | 'ADMIN';
  paintedPixels: number;
}

const INPUT_CLASS =
  "focus-ring w-full pl-8 pr-2 py-1.5 bg-surface-solid border border-border rounded-lg text-sm text-content placeholder:text-content-subtle transition-colors";

/** 한 번에 불러오는 유저 수 */
const PAGE_SIZE = 20;

export const UserManager = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  /** 동작이 진행 중인 유저. 같은 행의 버튼을 중복 클릭하지 못하게 막는다. */
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

  const { setNotification } = useNotification();
  const { email: myEmail } = useAuth();

  const load = useCallback(async (search: string) => {
    setLoading(true);

    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (search) query.set('keyword', search);

    const result = await apiFetch(FetchMethod.GET, `/admin/users?${query.toString()}`);

    if (result.internalStatusCode !== '0000') {
      setNotification({
        title: '관리자',
        content: result.message ?? '유저 목록을 불러오지 못했습니다.',
        type: Type.WARNING,
      });
      setLoading(false);
      return;
    }

    setUsers(result.data.users);
    setLoading(false);
  }, [setNotification]);

  // 검색어 입력마다 요청이 나가지 않도록 잠깐 기다렸다 보낸다.
  useEffect(() => {
    const timer = setTimeout(() => void load(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword, load]);

  const runAction = async (
    user: AdminUser,
    action: () => Promise<Awaited<ReturnType<typeof apiFetch>>>,
  ) => {
    setBusyIndex(user.index);

    const result = await action();

    if (result.internalStatusCode !== '0000') {
      setNotification({
        title: '관리자',
        content: result.message ?? '요청을 처리하지 못했습니다.',
        type: Type.WARNING,
      });
      setBusyIndex(null);
      return;
    }

    setNotification({ title: '관리자', content: result.message ?? '처리했습니다.' });
    setBusyIndex(null);
    await load(keyword);
  };

  const handleToggleRestrict = (user: AdminUser) =>
    runAction(user, () =>
      apiFetch(FetchMethod.PATCH, `/admin/users/${user.index}/restrict`, {
        restricted: !user.restricted,
      }));

  const handleRollback = (user: AdminUser) => {
    // 되돌린 픽셀은 복구할 수 없으므로 한 번 더 묻는다.
    const confirmed = window.confirm(
      `${user.username} 님이 칠한 픽셀 ${user.paintedPixels.toLocaleString()}개를 모두 흰색으로 되돌립니다.\n이 작업은 되돌릴 수 없습니다. 계속할까요?`,
    );
    if (!confirmed) return;

    return runAction(user, () =>
      apiFetch(FetchMethod.POST, `/admin/users/${user.index}/rollback`, {}));
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-subtle" />
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className={INPUT_CLASS}
            placeholder="이메일 또는 닉네임 검색"
            aria-label="유저 검색"
          />
        </div>
        <button
          type="button"
          onClick={() => void load(keyword)}
          aria-label="목록 새로고침"
          title="새로고침"
          className="focus-ring p-1.5 rounded-lg text-content-muted hover:bg-surface-hover hover:text-content transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 px-1 -mx-1">
        {users.length === 0 && !loading ?
          <p className="text-xs text-content-muted text-center py-4">검색 결과가 없습니다.</p>
          : null}

        {users.map((user) => {
          // 자기 자신에게는 서버가 제재/권한 변경을 거부하므로 버튼도 잠근다.
          const isSelf = user.email === myEmail;
          const isBusy = busyIndex === user.index;

          return (
            <div
              key={user.index}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface-hover border border-border"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-content truncate">{user.username}</span>
                  {user.role === 'ADMIN' ?
                    <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0" aria-label="관리자" />
                    : null}
                  {user.restricted ?
                    <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-danger text-app-bg shrink-0">
                      제재
                    </span>
                    : null}
                </div>
                <p className="text-[11px] text-content-muted truncate">{user.email}</p>
                <p className="text-[11px] text-content-subtle">
                  픽셀 {user.paintedPixels.toLocaleString()}개
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isSelf || isBusy}
                  onClick={() => void handleToggleRestrict(user)}
                  title={isSelf ? '자기 자신은 제재할 수 없습니다' : user.restricted ? '제재 해제' : '제재'}
                  aria-label={user.restricted ? '제재 해제' : '제재'}
                  className={`focus-ring p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${user.restricted
                    ? 'text-ok hover:bg-ok/10'
                    : 'text-danger hover:bg-danger/10'}`}
                >
                  <Ban className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isBusy || user.paintedPixels === 0}
                  onClick={() => void handleRollback(user)}
                  title="이 유저가 칠한 픽셀 되돌리기"
                  aria-label="픽셀 되돌리기"
                  className="focus-ring p-1.5 rounded-md text-content-muted hover:bg-surface-raised hover:text-content transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
