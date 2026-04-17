import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

export function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="glass-card px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group min-w-0">
            <DraftKitLogo size={40} />
            <span className="text-lg sm:text-xl font-bold text-[#2a2318]">DraftKit</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <Button variant="ghost" size="sm" asChild className="px-2 sm:px-4">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button variant="gradient" size="sm" asChild className="px-3 sm:px-4">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
