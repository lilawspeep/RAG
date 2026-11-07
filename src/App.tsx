import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PageLoader } from './components/ui';
import { RequireAuth } from './auth/RequireAuth';
import Home from './pages/Home';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const Syllabus = lazy(() => import('./pages/Syllabus'));
const Advisor = lazy(() => import('./pages/Advisor'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminDocuments = lazy(() => import('./pages/admin/Documents'));
const AdminCourses = lazy(() => import('./pages/admin/Courses'));
const AdminCatalog = lazy(() => import('./pages/admin/Catalog'));
const AdminPlans = lazy(() => import('./pages/admin/Plans'));
const AdminSections = lazy(() => import('./pages/admin/Sections'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminMessages = lazy(() => import('./pages/admin/Messages'));
const AdminRag = lazy(() => import('./pages/admin/RagStatus'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  return (
    <div className="flex min-h-svh flex-col">
      <ScrollToTop />
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="syllabus" element={<Syllabus />} />
        <Route path="advisor" element={<Advisor />} />
        <Route path="contact" element={<Contact />} />
        <Route
          path="user"
          element={
            <RequireAuth>
              <UserDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAuth admin>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="documents" element={<AdminDocuments />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="sections" element={<AdminSections />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="rag" element={<AdminRag />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
