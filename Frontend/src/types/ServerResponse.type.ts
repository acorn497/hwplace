export interface ServerResponse {
  title?: string,
  message?: string,
  internalStatusCode?: string | number | number[] | string[],
  data?: any,
}