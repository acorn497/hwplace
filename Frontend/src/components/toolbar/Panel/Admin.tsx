import { useState } from "react";
import { PanelShell } from "../../common/PanelKit";
import { UserManager } from "./Admin/UserManager";
import { CanvasManager } from "./Admin/CanvasManager";
import { AdminLog } from "./Admin/AdminLog";
import { useAuth } from "../../../contexts/Auth.context";

type AdminTab = 'users' | 'canvas' | 'logs';

const TABS: { value: AdminTab; label: string }[] = [
  { value: 'users', label: '유저' },
  { value: 'canvas', label: '캔버스' },
  { value: 'logs', label: '기록' },
];

export const Admin = () => {
  const [tab, setTab] = useState<AdminTab>('users');
  const { isAdmin } = useAuth();

  /*
    툴바가 관리자에게만 아이콘을 보여주지만, 그것만 믿지 않는다.
    권한이 내려간 뒤에도 열려 있던 패널이 그대로 남는 경우를 여기서 막는다.
    (진짜 방어선은 서버 가드이고, 이건 화면이 어긋나지 않게 하는 장치다)
  */
  if (!isAdmin) {
    return (
      <PanelShell title="관리자">
        <p className="text-sm text-content-muted">관리자 권한이 필요합니다.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="관리자"
      actions={
        <div role="tablist" aria-label="관리자 메뉴" className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-hover border border-border">
          {TABS.map((item) => {
            const isActive = item.value === tab;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.value)}
                className={`focus-ring px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${isActive
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-content-muted hover:text-content'}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      }
    >
      {tab === 'users' ? <UserManager /> : null}
      {tab === 'canvas' ? <CanvasManager /> : null}
      {tab === 'logs' ? <AdminLog /> : null}
    </PanelShell>
  );
};
