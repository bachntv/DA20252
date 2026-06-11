// utils/authFetch.js
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

/**
 * Custom fetch function for authenticated requests with token refresh
 * and improved redirect handling
 */
export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;
  const buildHeaders = (accessToken) => ({
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  });

  // If no token at all, redirect to login with current path
  if (!token) {
    console.warn("No token found. Redirecting to login...");
    // Save current path for redirect after login
    const currentPath = window.location.pathname;
    localStorage.setItem('redirectAfterLogin', currentPath);
    window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
    return new Promise(() => {}); // Cancel the fetch
  }

  // First attempt with current token
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(token),
    credentials: "include",
  });

  // If unauthorized, try to refresh the token
  if (res.status === 401) {
    console.log("Token expired or invalid. Attempting to refresh...");
    
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
      });

      if (!refreshRes.ok) {
        console.warn("Refresh token failed. Redirecting to login...");
        // Save current path for redirect after login
        const currentPath = window.location.pathname;
        localStorage.setItem('redirectAfterLogin', currentPath);
        // Clear invalid tokens
        localStorage.removeItem("token");
        // Redirect to login
        window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
        return new Promise(() => {}); // Cancel the fetch
      }

      // Refresh successful, store new token
      const data = await refreshRes.json();
      localStorage.setItem("token", data.access_token);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("authUser", JSON.stringify(data.user));
        window.dispatchEvent(new Event("profileUpdated"));
      }
      console.log("Token refreshed successfully");

      // Retry the original request with the new token
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(data.access_token),
        credentials: "include",
      });
      
      // If still unauthorized after refresh, redirect to login
      if (res.status === 401) {
        console.warn("Still unauthorized after token refresh. Redirecting to login...");
        const currentPath = window.location.pathname;
        localStorage.setItem('redirectAfterLogin', currentPath);
        localStorage.removeItem("token");
        window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
        return new Promise(() => {}); // Cancel the fetch
      }
    } catch (error) {
      console.error("Error during token refresh:", error);
      // Handle network errors during refresh
      const currentPath = window.location.pathname;
      localStorage.setItem('redirectAfterLogin', currentPath);
      window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
      return new Promise(() => {}); // Cancel the fetch
    }
  }

  return res;
};
