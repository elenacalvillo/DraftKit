import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { TrackingNotice } from "@/components/privacy/TrackingNotice";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Availability from "./pages/Availability";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import PublicBooking from "./pages/PublicBooking";
import Demo from "./pages/Demo";
import AdminAnalytics from "./pages/AdminAnalytics";
import MyRequests from "./pages/MyRequests";
import Transparency from "./pages/Transparency";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";
import Subscription from "./pages/Subscription";
import Retrospective from "./pages/Retrospective";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <TrackingNotice />
          <Toaster />
          <Sonner />
          <FeedbackWidget />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/transparency" element={<Transparency />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/availability" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
            <Route path="/dashboard/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="/dashboard/my-requests" element={<ProtectedRoute requireCreator={false}><MyRequests /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route path="/dashboard/workspace/:requestId" element={<ProtectedRoute requireCreator={false}><Workspace /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requireCreator={false}><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/retro/:collabId" element={<ProtectedRoute requireCreator={false}><Retrospective /></ProtectedRoute>} />
            <Route path="/:username" element={<PublicBooking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
