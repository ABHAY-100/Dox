import axios from "axios";
import { userAtom } from "@/store/auth";
import { getDefaultStore } from "jotai";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const apiRequest = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        const store = getDefaultStore();
        store.set(userAtom, null);

        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);
