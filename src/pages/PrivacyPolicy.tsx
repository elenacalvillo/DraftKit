import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, Database, Share2, Lock, UserCheck, Mail, ArrowLeft, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";

const sections = [
  {
    icon: Database,
    title: "Information We Collect",
    points: [
      {
        title: "Account Information",
        text: "When you create an account, we collect your email address and display name. If you sign in with Google, we receive your basic profile information."
      },
      {
        title: "Public Newsletter Data",
        text: "If you provide your Substack URL, we access your publicly available RSS feed to help generate collaboration ideas. We only read public content—never private posts or subscriber data."
      },
      {
        title: "Collaboration Requests",
        text: "We store the collaboration requests you send and receive, including messages, dates, and draft content you create within DraftKit."
      },
      {
        title: "Usage Analytics",
        text: "We collect anonymous, session-based analytics to understand which features are helpful and improve your experience. We do not build personal profiles or use fingerprinting."
      }
    ]
  },
  {
    icon: Share2,
    title: "How We Use Your Information",
    points: [
      {
        title: "Provide Our Services",
        text: "To operate your booking page, manage collaboration requests, and generate draft content based on your preferences."
      },
      {
        title: "Improve DraftKit",
        text: "To understand usage patterns and make DraftKit better for all creators. This includes analyzing feature adoption and fixing bugs."
      },
      {
        title: "Communication",
        text: "To send you collaboration notifications, important updates about your account, and occasional product news (which you can opt out of)."
      }
    ]
  },
  {
    icon: Lock,
    title: "Third-Party Services",
    points: [
      {
        title: "Google APIs",
        text: "DraftKit uses Google Docs API solely to create documents when you choose to export your drafts. We only create new documents with content you explicitly export—we never read, modify, or access any of your existing Google documents."
      },
      {
        title: "Google API Limited Use Disclosure",
        text: "DraftKit's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We only use Google API access to export drafts you create, and this data is not used for any other purpose."
      },
      {
        title: "Authentication Providers",
        text: "We use secure authentication services for sign-in. When you use Google Sign-In, we receive only your basic profile information (name, email, profile picture)."
      },
      {
        title: "Analytics",
        text: "We use privacy-respecting analytics to understand how DraftKit is used. No personal data is shared with advertising networks."
      }
    ]
  },
  {
    icon: Shield,
    title: "Data Security",
    points: [
      {
        title: "Row Level Security",
        text: "Your data is protected by enterprise-grade Row Level Security (RLS), ensuring your requests, drafts, and settings are accessible only to you and the people you choose to collaborate with."
      },
      {
        title: "Encryption",
        text: "All data is encrypted in transit using TLS and at rest using industry-standard encryption."
      },
      {
        title: "Secure Authentication",
        text: "We use secure, token-based authentication and never store your passwords in plain text."
      }
    ]
  },
  {
    icon: UserCheck,
    title: "Your Rights",
    points: [
      {
        title: "Access Your Data",
        text: "You can view all your collaboration requests, drafts, and settings within your DraftKit dashboard at any time."
      },
      {
        title: "Correct Your Data",
        text: "You can update your profile information, settings, and preferences through the Settings page."
      },
      {
        title: "Delete Your Data",
        text: "You can request deletion of your account and all associated data by contacting us at hello@draftkit.app. We will process deletion requests within 30 days."
      },
      {
        title: "Data Portability",
        text: "You can export your drafts to Google Docs or Word format at any time."
      }
    ]
  },
  {
    icon: Mail,
    title: "Contact Us",
    points: [
      {
        title: "Questions or Concerns",
        text: "If you have any questions about this Privacy Policy or how we handle your data, please contact us at hello@draftkit.app."
      },
      {
        title: "Data Requests",
        text: "For data access, correction, or deletion requests, email hello@draftkit.app with the subject line 'Data Request'."
      }
    ]
  }
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-6 flex items-center justify-center shadow-lg">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Privacy <span className="gradient-text">Policy</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            Your privacy matters to us. This policy explains how DraftKit collects, uses, and protects your information.
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated: January 30, 2026
          </p>
          <div className="mt-4">
            <Link
              to="/transparency"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            >
              <Shield className="w-4 h-4" />
              Read our human-friendly privacy promise
            </Link>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{section.title}</h2>
              </div>
              
              <div className="space-y-4 ml-16">
                {section.points.map((point, pointIndex) => (
                  <div key={pointIndex} className="border-l-2 border-primary/20 pl-4">
                    <h3 className="font-semibold text-foreground">{point.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{point.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Updates Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-8 mt-8"
        >
          <h2 className="text-2xl font-bold mb-4">Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. If we make significant changes, we will notify you by email or by posting a notice on our website before the changes take effect. We encourage you to review this policy periodically for the latest information on our privacy practices.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center mt-16"
        >
          <h3 className="text-2xl font-bold mb-4">Ready to collaborate with confidence?</h3>
          <p className="text-muted-foreground mb-6">
            Join creators who trust DraftKit with their collaborations.
          </p>
          <Button asChild variant="hero" size="lg">
            <Link to="/signup">
              Create Your Booking Page
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
