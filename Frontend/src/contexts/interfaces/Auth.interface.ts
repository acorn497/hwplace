/**
 * 계정 권한.
 *
 * 이 값은 UI 표시(관리자 패널 노출 여부)에만 쓴다.
 * 실제 접근 제어는 서버가 매 요청마다 DB를 보고 판단하므로,
 * 로컬 값을 조작해도 관리 API는 열리지 않는다.
 */
export type UserRole = 'USER' | 'ADMIN';

export interface AuthContextType {
  username: string;
  setUsername: (username: string) => void;

  email: string;
  setEmail: (email: string) => void;

  accessToken: string;
  setAccessToken: (accessToken: string) => void;

  role: UserRole;
  setRole: (role: UserRole) => void;

  /** 제재된 계정인지. 픽셀 칠하기가 막혀 있음을 UI에 알리는 용도다. */
  restricted: boolean;
  setRestricted: (restricted: boolean) => void;

  /** 관리자 패널 노출 여부 */
  isAdmin: boolean;
}
