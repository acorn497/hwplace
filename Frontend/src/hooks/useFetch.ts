import axios from "axios"
import { ServerResponse } from "../types/ServerResponse.type";

export enum FetchMethod {
  GET = "GET",
  POST = "POST",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

export const useFetch = async (method: FetchMethod, uri: string, data?: any): Promise<ServerResponse> => {
  const result = (async (): Promise<ServerResponse> => {
    try {
      switch (method) {
        case FetchMethod.GET:
          return (await axios.get(import.meta.env.VITE_BACKEND_URL + uri)).data;
        case FetchMethod.POST:
          return (await axios.post(import.meta.env.VITE_BACKEND_URL + uri, data)).data;
        case FetchMethod.PATCH:
          return (await axios.patch(import.meta.env.VITE_BACKEND_URL + uri, data)).data;
        case FetchMethod.DELETE:
          return (await axios.delete(import.meta.env.VITE_BACKEND_URL + uri, data)).data;
      }
    } catch {
      return {}
    }
  })();

  return result;
}