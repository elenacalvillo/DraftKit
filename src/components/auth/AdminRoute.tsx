import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAdmin } from "@/hooks/useAdmin";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";
import NotFound from "@/pages/NotFound";

/** Admin-only gate. Non-admins get a 404 instead of a hint that this area exists. */
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requireCreator={false}>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="animate-pulse">
          <DraftKitLogo size={64} />
        </div>
      </div>
    );
  }

  if (!isAdmin) return <NotFound />;

  return <>{children}</>;
}
