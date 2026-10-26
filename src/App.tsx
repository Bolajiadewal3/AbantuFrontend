import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Clients from "./pages/Clients";
import Staff from "./pages/Staff";
import AdminDataImport from "./pages/AdminDataImport";
import Payslips from "./pages/Payslips";
import CarerDashboard from "./pages/CarerDashboard";
import CarerShifts from "./pages/CarerShifts";
import CarerCalendar from "./pages/CarerCalendar";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Settings from "./pages/Settings";
import AdminMessages from "./pages/AdminMessages";
import CarerMessages from "./pages/CarerMessages";
import CarerAlerts from "./pages/CarerAlerts";
import CarerRequests from "./pages/CarerRequests";
import CarerIncidentGuide from "./pages/CarerIncidentGuide";
import ELearningDashboard from "./pages/ELearningDashboard";
import ELearningNavbar from "./components/ELearningNavBar";
import CompetenciesAndObservations from "./pages/CompetenciesAndObservations";
import ToDoCourses from "./pages/ToDoCourses";
import CompletedCourses from "./pages/CompletedCourses";
import UpcomingExpiration from "./pages/UpcomingExpiration";
import AdminCreateCourse from "./pages/AdminCreateCourse";
import AdminAddExternalCert from "./pages/AdminAddExternalCert";
import AdminComplianceMatrix from "./pages/AdminComplianceMatrix";
import AdminManageEnrolments from "./pages/AdminManageEnrolments";
import AdminAuditTrail from "./pages/AdminAuditTrail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CoursePlayerPage from "./pages/CarerCoursePlayerWrapper";
import { isLearningCenterEnabled } from "./utils/features";

function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="w-full min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950 transition-colors">
        <Outlet />
      </main>
    </>
  );
}

// Add this inside App.tsx next to your other AppLayout
function ELearningLayout() {
  return (
    <>
      <ELearningNavbar />
      <div className="w-full min-h-[calc(100vh-65px)] bg-slate-950 transition-colors">
        <Outlet />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute requiredRoles={["Admin", "Manager", "Carer"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/care-info" element={<CarerIncidentGuide />} />
          </Route>
        </Route>

        {isLearningCenterEnabled && (
          <>
            <Route element={<ProtectedRoute />}>
              <Route element={<ELearningLayout />}>
                <Route
                  path="/elearning/dashboard"
                  element={<ELearningDashboard />}
                />
                <Route path="/elearning/todo" element={<ToDoCourses />} />
                <Route
                  path="/elearning/courses/:id"
                  element={<CoursePlayerPage />}
                />
                <Route
                  path="/elearning/completed"
                  element={<CompletedCourses />}
                />
                <Route
                  path="/elearning/expiring"
                  element={<UpcomingExpiration />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute requiredRoles={["Admin", "Manager"]} />}>
              <Route
                path="/elearning/admin/create"
                element={<AdminCreateCourse />}
              />
              <Route path="/elearning/admin/import" element={<Login />} />
              <Route
                path="/elearning/admin/external-cert"
                element={<AdminAddExternalCert />}
              />
              <Route
                path="/elearning/admin/enrolments"
                element={<AdminManageEnrolments />}
              />
              <Route
                path="/elearning/admin/compliance"
                element={<AdminComplianceMatrix />}
              />
            </Route>
          </>
        )}

        {/* Carer Routes */}
        <Route element={<ProtectedRoute requiredRoles={["Carer"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/user/dashboard" element={<CarerDashboard />} />
            <Route path="/user/shifts" element={<CarerShifts />} />
            <Route path="/user/calendar" element={<CarerCalendar />} />
            <Route path="/user/messages" element={<CarerMessages />} />
            <Route path="/user/alerts" element={<CarerAlerts />} />
            <Route path="/user/requests" element={<CarerRequests />} />
            <Route path="/payslips" element={<Payslips />} />
          </Route>
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute requiredRoles={["Admin", "Manager"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/roster" element={<Roster />} />
            <Route path="/admin/clients" element={<Clients />} />
            <Route path="/admin/import" element={<AdminDataImport />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/staff" element={<Staff />} />
            <Route path="/admin/payslips" element={<Payslips />} />
            <Route
              path="/admin/observationsAndCompetencies"
              element={<CompetenciesAndObservations />}
            />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/requests" element={<CarerRequests />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute requiredRole="Admin" />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/audit-trail" element={<AdminAuditTrail />} />
          </Route>
        </Route>

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
