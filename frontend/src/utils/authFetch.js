// utils/authFetch.js
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

// Ham dung chung de goi cac API can dang nhap.
export const authFetch = async (url, options = {}) => {
  // Access token duoc frontend luu sau khi dang nhap thanh cong.
  const token = localStorage.getItem("token");

  // FormData tu dat Content-Type; cac request JSON thi gan application/json.
  const isFormData = options.body instanceof FormData;
  const buildHeaders = (accessToken) => ({
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  });

  // Chua co token thi ghi nho trang hien tai va dua nguoi dung den trang dang nhap.
  if (!token) {
    console.warn("No token found. Redirecting to login...");
    const currentPath = window.location.pathname;
    localStorage.setItem('redirectAfterLogin', currentPath);
    window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
    return new Promise(() => {}); // Cancel the fetch
  }

  // Gui request lan dau, kem access token trong Authorization header.
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(token),
    credentials: "include",
  });

  // Ma 401 thuong co nghia access token da het han hoac khong hop le.
  if (res.status === 401) {
    console.log("Token expired or invalid. Attempting to refresh...");
    
    try {
      // Cookie refresh_token duoc trinh duyet gui tu dong nho credentials=include.
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
      });

      if (!refreshRes.ok) {
        console.warn("Refresh token failed. Redirecting to login...");
        const currentPath = window.location.pathname;
        localStorage.setItem('redirectAfterLogin', currentPath);
        // Refresh token cung khong hop le: xoa phien cu va yeu cau dang nhap lai.
        localStorage.removeItem("token");
        // Redirect to login
        window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
        return new Promise(() => {}); // Cancel the fetch
      }

      // Luu access token moi va cap nhat thong tin user tren giao dien.
      const data = await refreshRes.json();
      localStorage.setItem("token", data.access_token);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("authUser", JSON.stringify(data.user));
        window.dispatchEvent(new Event("profileUpdated"));
      }
      console.log("Token refreshed successfully");

      // Goi lai dung API ban dau, lan nay dung access token moi.
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(data.access_token),
        credentials: "include",
      });
      
      // Van bi 401 sau khi refresh thi phien dang nhap khong the tiep tuc.
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
      // Loi mang khi refresh cung dua nguoi dung ve trang dang nhap.
      const currentPath = window.location.pathname;
      localStorage.setItem('redirectAfterLogin', currentPath);
      window.location.href = `/signin?redirect=${encodeURIComponent(currentPath)}`;
      return new Promise(() => {}); // Cancel the fetch
    }
  }

  return res;
};
