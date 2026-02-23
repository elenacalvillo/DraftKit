import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

interface ProtectedRouteProps {
  children: ReactNode;
  requireCreator?: boolean;
}

export function ProtectedRoute({ children, requireCreator = true }: ProtectedRouteProps) {
  const { user, creator, loading, creatorLoading } = useAuth();
  const location = useLocation();

  // Still resolving auth session
  if (loading) {
    return <LoadingScreen />;
  }

  // No user — redirect to login, preserving intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User exists but creator profile is still being fetched
  if (requireCreator && creatorLoading) {
    return <LoadingScreen />;
  }

  // User exists, creator fetch complete, but no creator profile — send to onboarding
  if (requireCreator && !creator) {
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="animate-pulse">
        <DraftKitLogo size={64} />
      </div>
    </div>
  );
}
