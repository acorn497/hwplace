import axios from "axios"

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

interface useFetchProps {
  method: HttpMethod,
  url: string
}

export const useFetch = ({ method, url }: useFetchProps): Promise<Response> => {
  switch (method) {
    default:
    case HttpMethod.GET:
      return axios.get(url);
    case HttpMethod.POST:
      return axios.post(url);
    case HttpMethod.PATCH:
      return axios.patch(url);
    case HttpMethod.DELETE:
      return axios.delete(url);
  }
}