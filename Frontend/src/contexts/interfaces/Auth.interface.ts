export interface AuthContextType {
  username: string;
  setUsername: (username: string) => void;

  email: string;
  setEmail: (email: string) => void;

  accessToken: string;
  setAccessToken: (accessToken: string) => void;
}