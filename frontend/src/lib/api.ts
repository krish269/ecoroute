import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
});

// Attach access token automatically
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = Cookies.get("refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          Cookies.set("access_token", res.data.access_token, { expires: 1 });
          Cookies.set("refresh_token", res.data.refresh_token, { expires: 7 });
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return axios(error.config);
        } catch {
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email: string, password: string) => {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  return api.post("/api/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

export const register = (email: string, password: string, display_name: string) =>
  api.post("/api/auth/register", { email, password, display_name });

export const getMe = () => api.get("/api/users/me");
export const updateWallet = (wallet_address: string) =>
  api.put("/api/users/me/wallet", { wallet_address });

// Submissions
export const getSubmissions = () => api.get("/api/submissions/");
export const getImpact = () => api.get("/api/submissions/impact");
export const submitWastePhoto = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/submissions/", form);
};

// Admin
export const getBins = () => api.get("/api/bins/");
export const simulateSensors = () => api.post("/api/bins/simulate");
export const runPredictions = () => api.post("/api/routes/predict");
export const generateRoutes = (operational_date: string, vehicle_ids: string[]) =>
  api.post("/api/routes/generate", { operational_date, vehicle_ids });
export const getTodayRoutes = () => api.get("/api/routes/today");
export const getAnalytics = () => api.get("/api/routes/analytics");
export const markStopCollected = (stop_id: string, actual_fill_pct: number) =>
  api.post(`/api/routes/stops/${stop_id}/collect`, { actual_fill_pct });
