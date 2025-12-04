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