export enum ConnectionStatus {
  DISCONNECTED = "연결 끊김",
  CONNECTING = "CONNECTING...",
  CONNECTED = "서버 연결 완료",
  ERROR = "연결 오류",
  /** 재연결 시도가 모두 소진된 최종 실패 */
  FAILED = "연결 실패",
}
