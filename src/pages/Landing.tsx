import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FeatureRoadmapSection } from "@/components/landing/FeatureRoadmapSection";
import { Footer } from "@/components/layout/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FeatureRoadmapSection />
      <Footer />
    </div>
  );
}
