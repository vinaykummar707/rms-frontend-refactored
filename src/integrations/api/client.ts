import axios from "axios";
import { env } from "@/config/env";

export const apiClient = axios.create({
  baseURL: env.VITE_CONTROLLER_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("navitronix:unauthorized"));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

