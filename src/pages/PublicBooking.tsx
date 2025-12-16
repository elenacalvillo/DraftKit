import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Check, ExternalLink, Sparkles, Mail, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { getCreator, getAvailability, getRequests, createRequest, Creator, Availability } from "@/lib/storage";
import { toast } from "sonner";

export default function PublicBooking() {
  const { username } = useParams<{ username: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    substackUrl: "",
    message: "",
  });

  useEffect(() => {
    if (!username) return;

    const creatorData = getCreator(username);
    if (!creatorData) {
      setNotFound(true);
      return;
    }

    setCreator(creatorData);

    const availData = getAvailability(username);
    setAvailability(availData);

    const requests = getRequests(username);
    setBookedDates(
      requests.filter((r) => r.status === "approved").map((r) => r.requestedDate)
    );
  }, [username]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !username) return;

    // Check if date is still available
    const currentRequests = getRequests(username);
    const isDateTaken = currentRequests.some(
      (r) => r.requestedDate === selectedDate && r.status !== "declined"
    );

    if (isDateTaken) {
      toast.error("This date has just been booked. Please select another date.");
      setSelectedDate(null);
      return;
    }

    setIsSubmitting(true);

    // Simulate network delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 800));

    createRequest(username, {
      requesterName: formData.name,
      requesterEmail: formData.email,
      requesterSubstackUrl: formData.substackUrl,
      message: formData.message,
      requestedDate: selectedDate,
    });

    setIsSubmitting(false);
    setIsSuccess(true);
    toast.success("Request sent successfully!");
  };

  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (notFound) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Creator Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The creator you're looking for doesn't exist or has been removed.
          </p>
          <Button variant="gradient" asChild>
            <Link to="/">Go to Homepage</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-tr from-accent/20 to-transparent blur-3xl"
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to CollabFlow</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 rounded-full gradient-primary mx-auto mb-6 flex items-center justify-center shadow-glow">
            <span className="text-3xl font-bold text-primary-foreground">
              {creator.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{creator.name}</h1>
          {creator.substackUrl && (
            <a
              href={creator.substackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              View Substack
            </a>
          )}
          {creator.welcomeMessage && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {creator.welcomeMessage}
            </p>
          )}
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-20 h-20 rounded-full bg-success/20 mx-auto mb-6 flex items-center justify-center"
                >
                  <Check className="w-10 h-10 text-success" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Request Sent!</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {creator.name} has received your collaboration request for{" "}
                  <span className="font-medium text-foreground">
                    {formatSelectedDate(selectedDate!)}
                  </span>
                  . They'll be in touch soon.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsSuccess(false);
                    setSelectedDate(null);
                    setFormData({ name: "", email: "", substackUrl: "", message: "" });
                  }}
                >
                  Request Another Date
                </Button>
              </motion.div>
            ) : selectedDate ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => setSelectedDate(null)}
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to calendar
                </button>

                <div className="mb-8">
                  <div className="inline-flex items-center gap-3 px-4 py-3 bg-primary/10 rounded-xl">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-medium">
                      {formatSelectedDate(selectedDate)}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Your Name
                      </Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="John Doe"
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="john@example.com"
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="substackUrl" className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Your Substack URL
                    </Label>
                    <Input
                      id="substackUrl"
                      type="url"
                      required
                      value={formData.substackUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, substackUrl: e.target.value })
                      }
                      placeholder="https://yourname.substack.com"
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Message to {creator.name}
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Tell them about the collaboration you have in mind..."
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Request Collaboration
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center mb-8">
                  <h2 className="text-xl font-semibold mb-2">Select a Date</h2>
                  <p className="text-muted-foreground">
                    Choose an available date to collaborate with {creator.name}
                  </p>
                </div>

                <CollabCalendar
                  availableDates={availability?.availableDates || []}
                  bookedDates={bookedDates}
                  blockedDates={availability?.blockedDates || []}
                  onDateSelect={handleDateSelect}
                />

                {availability?.availableDates?.length === 0 && (
                  <div className="text-center mt-6 p-6 bg-muted/50 rounded-xl">
                    <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {creator.name} hasn't set any available dates yet.
                      <br />
                      Check back later!
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Powered by CollabFlow
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
