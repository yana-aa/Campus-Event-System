import { Navigate, Route, Routes } from 'react-router-dom';
import { homePathFor, useAuth } from './auth/AuthContext';
import { RequireRole } from './auth/RequireRole';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/ui';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { BookEventPage } from './pages/BookEventPage';
import { BookingConfirmationPage } from './pages/BookingConfirmationPage';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CheckInPage } from './pages/organizer/CheckInPage';
import { CreateEventPage } from './pages/organizer/CreateEventPage';
import { OrganizerDashboardPage } from './pages/organizer/OrganizerDashboardPage';
import { RegisterPage } from './pages/RegisterPage';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading" fullPage />;
  return <Navigate to={homePathFor(user?.role)} replace />;
}

/** All routes. Wrapped by a Router in main.tsx (BrowserRouter) or tests (MemoryRouter). */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailsPage />} />
        <Route path="/events/:id/book" element={<RequireRole roles={['STUDENT']}><BookEventPage /></RequireRole>} />
        <Route path="/bookings/:bookingId/confirmation" element={<RequireRole roles={['STUDENT']}><BookingConfirmationPage /></RequireRole>} />
        <Route path="/my-tickets" element={<RequireRole roles={['STUDENT']}><MyTicketsPage /></RequireRole>} />
        <Route path="/organizer" element={<Navigate to="/organizer/dashboard" replace />} />
        <Route path="/organizer/dashboard" element={<RequireRole roles={['ORGANIZER']}><OrganizerDashboardPage /></RequireRole>} />
        <Route path="/organizer/events/new" element={<RequireRole roles={['ORGANIZER']}><CreateEventPage /></RequireRole>} />
        <Route path="/organizer/check-in" element={<RequireRole roles={['ORGANIZER', 'ADMIN']}><CheckInPage /></RequireRole>} />
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/overview" element={<RequireRole roles={['ADMIN']}><AdminOverviewPage /></RequireRole>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
