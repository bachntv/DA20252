import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// --------------------------
// Helper for API calls
// --------------------------
const api = {
  get: async (url, params) => {
    try {
      const res = await axios.get(`${BASE_URL}${url}`, { params });
      return res.data;
    } catch (err) {
      return handleApiError(err);
    }
  },
  post: async (url, data, params) => {
    try {
      const res = await axios.post(`${BASE_URL}${url}`, data, { params });
      return res.data;
    } catch (err) {
      return handleApiError(err);
    }
  },
  put: async (url, data) => {
    try {
      const res = await axios.put(`${BASE_URL}${url}`, data);
      return res.data;
    } catch (err) {
      return handleApiError(err);
    }
  },
  delete: async (url) => {
    try {
      const res = await axios.delete(`${BASE_URL}${url}`);
      return res.data;
    } catch (err) {
      return handleApiError(err);
    }
  }
};

// --------------------------
// Error handler
// --------------------------
const handleApiError = (error) => {
  if (error.response) {
    return {
      error: true,
      status: error.response.status,
      data: error.response.data
    };
  }
  return {
    error: true,
    status: 500,
    data: { detail: "Unknown error" }
  };
};

// --------------------------
// Generic path helper
// --------------------------
const path = (userId, section) =>
  `/settings/advanced/${userId}/${section}`;

// --------------------------
// Import / Export / Reset
// --------------------------
export const importSettings = (userId, settingsObj) =>
  api.post(`${path(userId, "import")}`, settingsObj);

export const exportSettings = (userId) =>
  api.get(`${path(userId, "export")}`);

export const resetAllSettings = (userId) =>
  api.post(`${path(userId, "reset")}`);

// Toggle notifications (all)
export const toggleAllNotifications = (userId, enable = true) =>
  api.post(`${path(userId, "notifications/toggle")}`, null, { enable });

// --------------------------
// SECTION HELPERS
// --------------------------
export const getTheme = (userId) => api.get(path(userId, "theme"));
export const updateTheme = (userId, data) =>
  api.put(path(userId, "theme"), data);
export const deleteTheme = (userId) =>
  api.delete(path(userId, "theme"));

export const getLanguage = (userId) => api.get(path(userId, "language"));
export const updateLanguage = (userId, data) =>
  api.put(path(userId, "language"), data);
export const deleteLanguage = (userId) =>
  api.delete(path(userId, "language"));

export const getSecurity = (userId) => api.get(path(userId, "security"));
export const updateSecurity = (userId, data) =>
  api.put(path(userId, "security"), data);
export const deleteSecurity = (userId) =>
  api.delete(path(userId, "security"));

// --------------------------
// Advanced settings (full)
// --------------------------
export const getAdvancedSettings = (userId) =>
  api.get(`/settings/advanced/${userId}`);

export const updateAdvancedSettings = (userId, data) =>
  api.put(`/settings/advanced/${userId}`, data);

export const updateNotifications = (userId, data) =>
  api.put(path(userId, "notifications"), data);

export const updatePrivacy = (userId, data) =>
  api.put(path(userId, "privacy"), data);

// --------------------------
// Get all sections in parallel
// --------------------------
export const getAllSettingsSections = (userId) =>
  Promise.all([
    getTheme(userId),
    getLanguage(userId),
    getSecurity(userId),
    getAdvancedSettings(userId)
  ]);
