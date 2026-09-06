import { LoggedOutView } from "./Profile/LoggedOutView";
import { LoggedInView } from "./Profile/LoggedInView";
import { useAuth } from "../../../contexts/Auth.context";
import { PanelShell } from "../../common/PanelKit";

export const Profile = () => {
  const { accessToken } = useAuth();

  return (
    <PanelShell title="프로필">
      <div className="h-full min-h-0 overflow-y-auto">
        {accessToken === "" ? <LoggedOutView /> : <LoggedInView />}
      </div>
    </PanelShell>
  );
}
