import { motion } from "framer-motion";
import { Mail, FileText, CalendarDays, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const oldWayItems = [
  { icon: <Mail className="w-5 h-5" />, text: "6 emails to agree on a topic" },
  { icon: <FileText className="w-5 h-5" />, text: "3 Google Docs, none final" },
  { icon: <CalendarDays className="w-5 h-5" />, text: "4 calendar pings to find a date" },
  { icon: <Mail className="w-5 h-5" />, text: '"Which version is this?" × 2' },
];

const newWayItems = [
  { text: "Structured request sent in 2 min" },
  { text: "SMART Draft generated instantly" },
  { text: "One shared workspace, one link" },
  { text: "Export to Substack in one click" },
];

export function BusyworkComparisonSection() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Reclaim your creative time.</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Every collaboration costs you 8.5 hours of admin. DraftKit gives them back.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* The Old Way */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 border border-destructive/20"
          >
            <h3 className="text-lg font-bold text-foreground mb-6">The Old Way</h3>
            <div className="space-y-4">
              {oldWayItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.1 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <span className="text-destructive/60">{item.icon}</span>
                  <span className="text-sm line-through decoration-destructive/40">{item.text}</span>
                </motion.div>
              ))}
            </div>
            <p className="text-sm font-semibold text-destructive mt-6">
              12+ emails. 3 apps. 8.5 hours of busywork.
            </p>
          </motion.div>

          {/* The DraftKit Way */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 border border-primary/20"
          >
            <h3 className="text-lg font-bold text-foreground mb-6">The DraftKit Way</h3>
            <div className="space-y-4">
              {newWayItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-foreground">{item.text}</span>
                </motion.div>
              ))}
            </div>
            <p className="text-sm font-semibold text-primary mt-6">
              One room. Zero busywork. 8 hours saved.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <Link to="/signup">
            <Button variant="hero" size="lg">
              Save your first 8 hours (Free)
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
