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
          className="glass-card p-6 sm:p-12 text-center border border-primary/20"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Grow together. Stay free.</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-2 text-sm leading-relaxed">
            Your first 3 collaborations are free.
          </p>
          <p className="text-primary font-medium max-w-md mx-auto mb-8 text-sm leading-relaxed">
            Unlock 1 extra collaboration credit for every new writer you invite who registers.
          </p>
          <Link to="/signup" className="inline-block w-full sm:w-auto">
            <Button variant="hero" size="xl" className="w-full sm:w-auto max-w-full">
              Start growing for free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
