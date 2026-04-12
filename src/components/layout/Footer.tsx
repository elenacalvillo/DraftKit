import { Link } from "react-router-dom";
import { Heart, Shield, BookOpen, FileText, ReceiptText, Scale } from "lucide-react";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <DraftKitLogo size={50} />
            <div>
              <span className="font-semibold text-foreground">DraftKit</span>
              <p className="text-xs text-muted-foreground">The engine for creators who ship together</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              to="/privacy"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Scale className="w-3.5 h-3.5" />
              Terms
            </Link>
            <Link
              to="/refund-policy"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ReceiptText className="w-3.5 h-3.5" />
              Refunds
            </Link>
            <Link
              to="/transparency"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              How we protect you
            </Link>
            <a
              href="mailto:hello@draftkit.app"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>

          {/* Copyright */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Built with</span>
            <Heart className="w-3.5 h-3.5 text-primary fill-primary" />
            <span>by</span>
            <a
              href="https://elenacalvillo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Elena Calvillo
            </a>
            <a
              href="https://substack.com/@elenacalvillo"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
              title="Follow on Substack"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </a>
            <span className="mx-2">·</span>
            <span>© {currentYear}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
