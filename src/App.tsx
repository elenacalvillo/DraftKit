import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { TrackingNotice } from "@/components/privacy/TrackingNotice";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PostAuthRedirect } from "@/components/auth/PostAuthRedirect";
import { ScrollToTop } from "@/components/ScrollToTop";
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
import Discovery from "./pages/Discovery";
import AgentInfo from "./pages/AgentInfo";
import TermsOfService from "./pages/TermsOfService";
import RefundPolicy from "./pages/RefundPolicy";
import PublicWorkspaceView from "./pages/PublicWorkspaceView";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // "Quiet mode" — prevents the network storm caused by browser extensions
      // (Grammarly/LanguageTool) triggering window-focus refetches and by
      // RLS-gated queries firing as anon → 403 → retry loops.
      staleTime: 5 * 60 * 1000, // 5 min — data considered fresh
      gcTime: 10 * 60 * 1000, // 10 min — keep cache around
      refetchOnWindowFocus: false, // kills the Grammarly trigger
      refetchOnReconnect: false, // kills WebSocket reconnect storms
      retry: 1, // stop hammering on RLS 403s
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <ScrollToTop />
          <PostAuthRedirect />
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
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/api/v1/agent-info" element={<AgentInfo />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/availability" element={<ProtectedRoute><Availability /></ProtectedRoute>} />
            <Route path="/dashboard/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="/dashboard/my-requests" element={<ProtectedRoute requireCreator={false}><MyRequests /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route path="/dashboard/discovery" element={<ProtectedRoute><Discovery /></ProtectedRoute>} />
            <Route path="/dashboard/workspace/:requestId" element={<ProtectedRoute requireCreator={false}><Workspace /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requireCreator={false}><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/retro/:collabId" element={<ProtectedRoute requireCreator={false}><Retrospective /></ProtectedRoute>} />
            <Route path="/view/:token" element={<PublicWorkspaceView />} />
            <Route path="/:username" element={<PublicBooking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
