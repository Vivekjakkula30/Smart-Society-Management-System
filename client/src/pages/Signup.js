// client/src/pages/Signup.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../services/authService";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[6-9]\d{9}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const allowedRoles = ["resident", "admin", "security"];
const securityShifts = ["6 AM - 2 PM", "2 PM - 10 PM", "10 PM - 6 AM"];

const Signup = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    userType: "", // user selects from dropdown
    shiftTiming: "", // only used when role = security
    flat_number: "", // only used when role = resident
    block_name: "", // only used when role = resident
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 👁️ show/hide password states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = formData.name.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedPhone = formData.phone.trim();
    const role = formData.userType.trim();
    const shift = formData.shiftTiming.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter a valid full name.");
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!phoneRegex.test(normalizedPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 8 characters and include letters and numbers.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!allowedRoles.includes(role)) {
      setError("Please select a role.");
      return;
    }

    if (role === "security" && !securityShifts.includes(shift)) {
      setError("Please select shift timing for security staff.");
      return;
    }

    if (role === "resident") {
      const flatNumber = formData.flat_number.trim();
      const blockName = formData.block_name.trim();

      if (!flatNumber) {
        setError("Please enter your flat number.");
        return;
      }

      if (!blockName) {
        setError("Please enter your block name.");
        return;
      }
    }

    const payload = {
      name: trimmedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: formData.password,
      userType: role,
      shiftTiming: role === "security" ? shift : null,
      flat_number: role === "resident" ? formData.flat_number.trim() : null,
      block_name: role === "resident" ? formData.block_name.trim() : null,
    };

    try {
      setLoading(true);
      await register(payload);

      alert(
        `Account created successfully as ${
          formData.userType.charAt(0).toUpperCase() +
          formData.userType.slice(1)
        }. Please login.`
      );
      navigate("/login");
    } catch (err) {
      console.error("Signup error (frontend):", err);
      setError(
        err?.response?.data?.message ||
          "Registration failed. Please check details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left info panel */}
        <div className="hidden md:flex flex-col justify-between py-10 px-8 rounded-3xl bg-white/80 backdrop-blur-md border border-gray-100 shadow-xl">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Create your Smart Society account
            </h1>
            <p className="text-sm text-gray-600">
              Choose your role carefully. Admins manage the society, residents
              manage their flats & complaints, and security handles visitors.
            </p>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div className="border border-indigo-100 rounded-2xl p-3">
              <h3 className="font-semibold text-indigo-700">Resident</h3>
              <p className="text-gray-600 text-xs mt-1">
                Raise complaints, view society notices and events, track your
                maintenance & payments.
              </p>
            </div>
            <div className="border border-emerald-100 rounded-2xl p-3">
              <h3 className="font-semibold text-emerald-700">Admin</h3>
              <p className="text-gray-600 text-xs mt-1">
                Manage residents, resolve complaints, publish notices/events,
                and monitor payments.
              </p>
            </div>
            <div className="border border-amber-100 rounded-2xl p-3">
              <h3 className="font-semibold text-amber-700">Security</h3>
              <p className="text-gray-600 text-xs mt-1">
                Manage visitor entry/exit and maintain visitor logs & security
                incidents. Shift timing is required for this role.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-8">
            By creating an account, you agree to follow all society rules and
            regulations.
          </p>
        </div>

        {/* Right form panel */}
        <div className="bg-white/80 backdrop-blur-md border border-gray-100 shadow-xl rounded-3xl p-8 md:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Get started 
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Fill in your details to create an account.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Select Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Role
              </label>
              <select
                name="userType"
                value={formData.userType}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                required
              >
                <option value="">Choose your role</option>
                <option value="resident">Resident</option>
                <option value="admin">Admin</option>
                <option value="security">Security</option>
              </select>
            </div>

            {/* Shift timing – only when Security selected */}
            {formData.userType === "security" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift Timing
                </label>

                <select
                  name="shiftTiming"
                  value={formData.shiftTiming}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50
                           focus:bg-white px-4 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                           transition"
                  required
                >
                  <option value="">Select shift</option>
                  <option value="6 AM - 2 PM">
                    6 AM - 2 PM (Morning Shift)
                  </option>
                  <option value="2 PM - 10 PM">
                    2 PM - 10 PM (Evening Shift)
                  </option>
                  <option value="10 PM - 6 AM">
                    10 PM - 6 AM (Night Shift)
                  </option>
                </select>
              </div>
            )}

            {/* Flat and Block – only when Resident selected */}
            {formData.userType === "resident" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Number
                  </label>
                  <input
                    type="text"
                    name="flat_number"
                    value={formData.flat_number}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="101"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Block Name
                  </label>
                  <input
                    type="text"
                    name="block_name"
                    value={formData.block_name}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="A"
                    required
                  />
                </div>
              </div>
            )}

            {/* Passwords with eye icons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 
                              focus:bg-white px-4 py-2.5 text-sm outline-none 
                              focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                    placeholder="Create a password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500"
                  >
                    {showPassword ? "👁️" : "👁️"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 
                              focus:bg-white px-4 py-2.5 text-sm outline-none 
                              focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                    placeholder="Re-enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-3 text-gray-500"
                  >
                    {showConfirmPassword ? "👁️" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 text-sm shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-medium text-indigo-600 hover:underline"
            >
              Login here
            </button>
          </p>

          <p className="mt-2 text-xs text-gray-400 text-center">
            You can update your details later from your profile (if allowed by
            admin).
          </p>

          {/* Back to Home button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2 text-sm text-white bg-indigo-600 rounded-xl shadow hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7m-9 2v6m0 0h4m-4 0H7m13-4v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8"
                />
              </svg>
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
