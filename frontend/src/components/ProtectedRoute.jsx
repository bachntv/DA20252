import React from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const ProtectedRoute = ({ children, requireRole }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/signin" replace />;
  }

  if (requireRole) {
    try {
      const roles = jwtDecode(token)?.roles || [];
      if (!roles.includes(requireRole)) {
        return <Navigate to="/" replace />;
      }
    } catch (err) {
      return <Navigate to="/signin" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
