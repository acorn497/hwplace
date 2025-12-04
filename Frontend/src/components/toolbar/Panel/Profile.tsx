import { LoggedOutView } from "./Profile/LoggedOutView";
import { LoggedInView } from "./Profile/LoggedInView";
import { useAuth } from "../../../contexts/Auth.context";

export const Profile = () => {
  const { accessToken } = useAuth();

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
        <h2 className="text-base font-semibold text-slate-800">프로필</h2>
      </div>
      <div className="overflow-hidden h-full relative">
        {accessToken === "" ? <LoggedOutView /> : <LoggedInView />}
      </div>
    </div>
  );
}