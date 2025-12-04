export interface GlobalResponse {
  title?: string,
  message?: string,
  data?: Object,
  internalStatusCode?: number[] | number | string[] | string,
  timestamp?: Date,
}