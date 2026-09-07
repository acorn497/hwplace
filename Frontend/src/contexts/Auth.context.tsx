import { createContext, PropsWithChildren, useContext, useEffect, useState, } from "react";
import { AuthContextType } from "./interfaces/Auth.interface";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 로그인 상태 관리 
 * 
 */
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [username, setUsername] = useState<string>(localStorage.getItem('username') ?? '');
  const [email, setEmail] = useState<string>(localStorage.getItem('email') ?? '');
  const [accessToken, setAccessToken] = useState<string>(localStorage.getItem('accessToken') ?? '');

  useEffect(() => {
    localStorage.setItem('username', username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem('email', email);
  }, [email]);

  useEffect(() => {
    localStorage.setItem('accessToken', accessToken);
  }, [accessToken]);

  /**
   * 서버가 401을 돌려주면(계정 삭제 등으로 토큰이 무효해진 경우)
   * useFetch가 저장소를 비우고 이 이벤트를 쏜다. 화면 상태도 함께 로그아웃으로 되돌린다.
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      setAccessToken('');
      setUsername('');
      setEmail('');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);
  
  const value: AuthContextType = {
    username, setUsername,
    email, setEmail,
    accessToken, setAccessToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth가 AuthProvider 외부에서 호출되었습니다.');
  }
  return context;
}