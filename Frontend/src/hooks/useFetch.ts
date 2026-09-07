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

/**
 * 토큰이 더 이상 통하지 않을 때 로그인 상태를 정리한다.
 *
 * 토큰은 로그인 시점의 사용자 정보를 담고 만료 전까지 유효하므로, 그 사이 계정이
 * 사라지면(탈퇴/DB 초기화) 서버는 401을 준다. 이때 토큰을 그대로 두면 이후 모든
 * 요청이 같은 이유로 계속 실패한다. 지워서 다시 로그인하도록 유도한다.
 */
const clearStaleSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('username');
  localStorage.removeItem('email');
  // 다른 탭과 컨텍스트가 로그아웃 상태를 따라오도록 알린다
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
};

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && localStorage.getItem('accessToken')) {
      clearStaleSession();
    }
    return Promise.reject(error);
  },
)

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