import { types } from "../components/Notification";

// Server Pixel Data Type
export interface ServerPixel {
  PIXEL_INDEX: number;
  PIXEL_POS_X: number;
  PIXEL_POS_Y: number;
  PIXEL_COLOR_R: number;
  PIXEL_COLOR_G: number;
  PIXEL_COLOR_B: number;
  PIXEL_UUID: string;
}

// Batch Update Type
export interface BatchPixelUpdateData {
  pixels: {
    x: number;
    y: number;
    color: { r: number; g: number; b: number };
  }[];
  uuid: string;
}

// Batch Response Type
export interface BatchPixelUpdatedResponse {
  pixels: {
    x: number;
    y: number;
    color: { r: number; g: number; b: number };
  }[];
  uuid: string;
  timestamp: string;
}

export interface MessageData {
  message: string;
  sender: string;
}

export type NotificationType = {
  id?: number;
  title: string;
  content: string;
  method?: types;
  duration?: number;
}