// client/src/services/authService.js
import api from "./api";

export const register = async (payload) => {
  console.log("📨 Sending register request to /auth/register:", payload);

  const res = await api.post("/auth/register", payload);
  console.log("✅ Register response:", res.data);
  return res.data;
};

export const login = async (email, password) => {
  console.log("📨 Sending login request to /auth/login:", { email, password });

  const res = await api.post("/auth/login", { email, password });
  console.log("✅ Login response:", res.data);
  return res.data;
};
