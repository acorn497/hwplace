export interface ServerResponse {
  title?: string,
  message?: string,
  internalStatusCode?: number | number[] | string[],
  data?: any,
}