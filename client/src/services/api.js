// client/src/services/api.js
import axios from "axios";

// 🔴 IMPORTANT: This must be your backend URL + /api
const api = axios.create({
  baseURL: "http://localhost:5000/api",
  // If you ever change backend port, update here
});

// Attach token if available (optional but fine)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
