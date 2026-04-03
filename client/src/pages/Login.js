// client/src/pages/Login.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginService } from "../services/authService";
import { saveAuthData } from "../utils/auth";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const data = await loginService(normalizedEmail, password);
      const { token, user } = data;
      const safeUser = {
        id: user?.id || user?.user_id,
        name: user?.name || user?.full_name || "User",
        email: user?.email || normalizedEmail,
        role: user?.role || user?.user_type || "resident",
      };
      saveAuthData(token, safeUser);
      localStorage.setItem("role", safeUser.role);
      localStorage.setItem("name", safeUser.name);
      if (safeUser.role === "admin") navigate("/admin-dashboard");
      else if (safeUser.role === "security") navigate("/security-dashboard");
      else navigate("/resident-dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotStatus("");
    // Simulate sending reset email
    await new Promise(r => setTimeout(r, 1200));
    setForgotStatus("sent");
    setForgotLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left – Branding */}
        <div className="hidden md:flex flex-col justify-between py-10 px-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-xl">
          <div>
            <h1 className="text-3xl font-bold mb-4">Smart Society Management System</h1>
            <p className="text-sm text-indigo-100">Manage complaints, notices, visitors, payments and more from a single, secure society dashboard.</p>
          </div>
          <div className="space-y-3 mt-8 text-sm text-indigo-100">
            <h2 className="text-lg font-semibold text-white">Why use this?</h2>
            <ul className="space-y-2">
              <li>• Quick complaint registration & tracking</li>
              <li>• Digital notices & event updates</li>
              <li>• Transparent maintenance & payment history</li>
            </ul>
          </div>
          <p className="text-xs text-indigo-200 mt-8">© {new Date().getFullYear()} Smart Society. All rights reserved.</p>
        </div>

        {/* Right – Login Form */}
        <div className="bg-white/80 backdrop-blur-md border border-gray-100 shadow-xl rounded-3xl p-8 md:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Welcome back 👋</h2>
            <p className="text-sm text-gray-500 mt-1">Login to access your society dashboard.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="you@example.com" required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => { setShowForgotModal(true); setForgotStatus(""); setForgotEmail(""); }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="Enter your password" required
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 text-sm shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Don't have an account?{" "}
            <button type="button" onClick={() => navigate("/signup")} className="font-medium text-indigo-600 hover:underline">
              Create new account
            </button>
          </p>
          <p className="mt-2 text-xs text-gray-400 text-center">By logging in, you agree to follow society rules & regulations.</p>
        </div>
      </div>

      {/* ===== FORGOT PASSWORD MODAL ===== */}
      {showForgotModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForgotModal(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            {forgotStatus === "sent" ? (
              <div className="text-center">
                <div className="text-5xl mb-4">📧</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Check your inbox!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  If <span className="font-medium text-indigo-600">{forgotEmail}</span> is registered, you'll receive a password reset link shortly.
                </p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 text-sm transition"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                    <p className="text-sm text-gray-500 mt-1">Enter your email to receive a reset link</p>
                  </div>
                  <button onClick={() => setShowForgotModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input
                      type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="you@example.com" required
                    />
                  </div>
                  <button
                    type="submit" disabled={forgotLoading}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 text-sm transition"
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                  <button
                    type="button" onClick={() => setShowForgotModal(false)}
                    className="w-full rounded-2xl border border-gray-200 text-gray-600 font-medium py-2.5 text-sm hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
