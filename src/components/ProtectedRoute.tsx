import { Navigate, Outlet } from "react-router-dom";
import { authStorage } from "../utils/auth";

interface ProtectedRouteProps {
  requiredRole?: "Admin" | "Carer";
  requiredRoles?: readonly ("Admin" | "Manager" | "Carer")[];
}

export default function ProtectedRoute({ requiredRole, requiredRoles }: ProtectedRouteProps) {
  const isAuthenticated = authStorage.isAuthenticated();
  const user = authStorage.getUser();
  const allowedRoles = requiredRoles ?? (requiredRole ? [requiredRole] : undefined);

  // 1. If not logged in, bounce to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. If a specific role is required and user doesn't have it, bounce to their default page
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <Navigate
        to={user?.role === "Admin" || user?.role === "Manager" ? "/admin/dashboard" : "/user/dashboard"}
        replace
      />
    );
  }

  // 3. User is authorized, render child components/routes
  return <Outlet />;
}
