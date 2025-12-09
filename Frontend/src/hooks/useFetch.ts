import axios from "axios"
import { ServerResponse } from "../types/ServerResponse.type";

export enum FetchMethod {
  GET = "GET",
  POST = "POST",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

axiosInstance.interceptors.request.use((config) => {
  if (localStorage.getItem('accessToken')) {
    config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
  }
  return config;
})

export const useFetch = async (method: FetchMethod, uri: string, data?: any): Promise<ServerResponse> => {
  try {
    switch (method) {
      case FetchMethod.GET:
        return (await axiosInstance.get(uri)).data;
      case FetchMethod.POST:
        return (await axiosInstance.post(uri, data)).data;
      case FetchMethod.PATCH:
        return (await axiosInstance.patch(uri, data)).data;
      case FetchMethod.DELETE:
        return (await axiosInstance.delete(uri, { data })).data;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) return error.response.data;
    else throw error;
  }
}