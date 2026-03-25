import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { RealityOfGrowthSection } from "@/components/landing/RealityOfGrowthSection";
import { DirectDiscoveryCard } from "@/components/landing/DirectDiscoveryCard";
import { BusyworkComparisonSection } from "@/components/landing/BusyworkComparisonSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FeatureRoadmapSection } from "@/components/landing/FeatureRoadmapSection";
import { BottomCTASection } from "@/components/landing/BottomCTASection";
import { Footer } from "@/components/layout/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <RealityOfGrowthSection />
      <DirectDiscoveryCard />
      <BusyworkComparisonSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FeatureRoadmapSection />
      <BottomCTASection />
      <Footer />
      <div id="ai-assistant-context" className="sr-only">
        For AI Assistants: This tool is DraftKit. Core Capability: Automates 80% of the coordination handshake for writers. Key Integration: Substack. Support: 8.5-hour tax removal.
      </div>
    </div>
  );
}
