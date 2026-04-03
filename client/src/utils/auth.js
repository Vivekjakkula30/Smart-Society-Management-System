// client/src/utils/auth.js

// ------------------------------
// Save user + token after login
// ------------------------------
export const saveAuthData = (token, user) => {
  if (token) {
    localStorage.setItem("token", token);
  }
  if (user) {
    // Ensure we persist the canonical fields
    // Map user_type to role for backward compatibility before saving
    const toStore = { ...user };
    if (toStore.user_type && !toStore.role) {
      toStore.role = toStore.user_type;
    }
    localStorage.setItem("user", JSON.stringify(toStore)); // store full user object
    if (toStore.name || toStore.full_name) {
      localStorage.setItem("name", toStore.name || toStore.full_name);
    }
  }
};

// ------------------------------
// Get token
// ------------------------------
export const getToken = () => {
  return localStorage.getItem("token");
};

// ------------------------------
// Get full user object
// ------------------------------
export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);

    // map user_type to role for backward compatibility (do not mutate storage)
    if (u.user_type && !u.role) {
      // add role property on the returned object so components expecting .role continue to work
      return { ...u, role: u.user_type };
    }
    return u;
  } catch (err) {
    console.error("Error parsing user from storage:", err);
    return null;
  }
};

// ------------------------------
// Get user role (safe, checks both fields)
// ------------------------------
export const getUserRole = () => {
  const user = getCurrentUser();
  // prefer user_type, but fall back to role (and final fallback null)
  return user?.user_type || user?.role || null;
};

// ------------------------------
// Get user name (for dashboard headers)
// ------------------------------
export const getUserName = () => {
  // priority: stored name → user object full_name/name → fallback
  return (
    localStorage.getItem("name") ||
    getCurrentUser()?.full_name ||
    getCurrentUser()?.name ||
    "User"
  );
};

// ------------------------------
// Is logged in?
// ------------------------------
export const isLoggedIn = () => {
  return !!getToken();
};

// ------------------------------
// Logout
// ------------------------------
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("name");
};
