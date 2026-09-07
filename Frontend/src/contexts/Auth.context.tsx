import { createContext, PropsWithChildren, useContext, useEffect, useState, } from "react";
import { AuthContextType, UserRole } from "./interfaces/Auth.interface";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 로그인 상태 관리 
 * 
 */
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [username, setUsername] = useState<string>(localStorage.getItem('username') ?? '');
  const [email, setEmail] = useState<string>(localStorage.getItem('email') ?? '');
  const [accessToken, setAccessToken] = useState<string>(localStorage.getItem('accessToken') ?? '');
  const [role, setRole] = useState<UserRole>(localStorage.getItem('role') === 'ADMIN' ? 'ADMIN' : 'USER');
  const [restricted, setRestricted] = useState<boolean>(localStorage.getItem('restricted') === 'true');

  useEffect(() => {
    localStorage.setItem('username', username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem('email', email);
  }, [email]);

  useEffect(() => {
    localStorage.setItem('accessToken', accessToken);
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('role', role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem('restricted', String(restricted));
  }, [restricted]);

  /**
   * 서버가 401을 돌려주면(계정 삭제 등으로 토큰이 무효해진 경우)
   * useFetch가 저장소를 비우고 이 이벤트를 쏜다. 화면 상태도 함께 로그아웃으로 되돌린다.
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      setAccessToken('');
      setUsername('');
      setEmail('');
      setRole('USER');
      setRestricted(false);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);
  
  const value: AuthContextType = {
    username, setUsername,
    email, setEmail,
    accessToken, setAccessToken,
    role, setRole,
    restricted, setRestricted,
    // 로그아웃 상태에서 저장된 역할이 남아 패널이 보이는 일이 없도록 토큰 유무도 함께 본다.
    isAdmin: accessToken !== '' && role === 'ADMIN',
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