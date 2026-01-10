import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <FeedbackWidget />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/availability" element={<Availability />} />
            <Route path="/dashboard/requests" element={<Requests />} />
            <Route path="/dashboard/my-requests" element={<MyRequests />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/:username" element={<PublicBooking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
