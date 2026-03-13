import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function BottomCTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card p-12 text-center border border-primary/20"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Grow first. Pay later.</h2>
          <p className="text-lg font-semibold text-foreground mb-2">
            Your first 3 published collaborations are free.
          </p>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 text-sm leading-relaxed">
            No credit card. No 7-day trial limits. Just human growth.
          </p>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              Get your 3 free collaborations (Free)
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
