import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookMarked,
  Calendar,
  Crown,
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePro } from "@/hooks/usePro";
import { ProBadge } from "@/components/subscription/ProBadge";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1280 : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
};

const baseNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Calendar, label: "Availability", path: "/dashboard/availability" },
  { icon: MessageSquare, label: "Collabs", path: "/dashboard/requests" },
  { icon: Send, label: "Proposals", path: "/dashboard/my-requests" },
  { icon: Sparkles, label: "Network", path: "/dashboard/discovery" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
  { icon: Crown, label: "Membership", path: "/dashboard/subscription" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  zenMode?: boolean;
  zenTitle?: string;
  zenBackPath?: string;
}

export function DashboardLayout({ children, zenMode, zenTitle, zenBackPath }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { creator, signOut } = useAuth();
  const { isPro, isProject } = usePro();
  const isDesktop = useIsDesktop();

  // Project tier users see a separate "Projects" entry above
  // Settings — kept visually distinct from the newsletter Collabs.
  const navItems = isProject
    ? [
        ...baseNavItems.slice(0, 5),
        { icon: BookMarked, label: "Projects", path: "/dashboard/projects" },
        ...baseNavItems.slice(5),
      ]
    : baseNavItems;

  useEffect(() => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isDesktop]);

  const sidebarVisible = isDesktop || isSidebarOpen;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Zen Mode: minimal 48px header, no sidebar, no nav
  if (zenMode) {
    return (
      <div className="min-h-screen gradient-bg">
        <div className="fixed top-0 left-0 right-0 z-50 h-12 glass-card rounded-none border-x-0 border-t-0 px-4 flex items-center">
          <button
            onClick={() => navigate(zenBackPath || "/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-w-[72px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <span
            className="flex-1 text-center text-sm font-medium truncate px-4"
          >
            {zenTitle || "Workspace"}
          </span>
          {/* Portal target for save controls rendered by SharedWorkspace */}
          <div id="zen-header-actions" className="flex items-center gap-3 min-w-[72px] justify-end" />
        </div>

        <main className="min-h-screen pt-12 overflow-x-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 xl:p-10"
          >
            {children}
          </motion.div>
        </main>
      </div>
    );
  }

  // Standard layout with sidebar
  return (
    <div className="min-h-screen gradient-bg">
      {/* Mobile header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 glass-card rounded-none border-x-0 border-t-0">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <DraftKitLogo size={32} />
            <span className="text-lg font-bold text-[#2a2318]">DraftKit</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarVisible ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed top-0 left-0 bottom-0 w-64 z-40 glass-card rounded-none border-y-0 border-l-0 p-6 flex flex-col"
      >
        <Link to="/dashboard" className="flex items-center gap-2 mb-10">
          <DraftKitLogo size={40} />
          <span className="text-xl font-bold text-[#2a2318]">DraftKit</span>
        </Link>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => !isDesktop && setIsSidebarOpen(false)}
              >
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 w-1 h-8 rounded-r-full bg-primary pointer-events-none"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-6 mt-6">
          {creator && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                {creator.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {creator.name}
                  {isPro && <ProBadge size="sm" />}
                </div>
                <p className="text-sm text-muted-foreground truncate">@{creator.username}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </motion.aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 xl:hidden"
        />
      )}

      {/* Main content */}
      <main className={cn(
        "min-h-screen pt-16 xl:pt-0 transition-[margin-left] duration-300",
        isDesktop && "ml-64"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 xl:p-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
