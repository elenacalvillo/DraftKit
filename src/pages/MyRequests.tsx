import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Calendar, Clock, ExternalLink, Inbox, ArrowRight, X, CalendarClock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SentRequest {
  id: string;
  creator_id: string;
  requester_name: string;
  requester_email: string;
  requester_substack_url: string | null;
  message: string | null;
  requested_date: string | null;
  status: string;
  created_at: string;
  creator: {
    name: string;
    username: string;
    profile_image_url: string | null;
    substack_url: string | null;
  } | null;
}

const statusVariants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

export default function MyRequests() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchSentRequests();
    }
  }, [user, authLoading, navigate]);

  const fetchSentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('collab_requests')
        .select(`
          id,
          creator_id,
          requester_name,
          requester_email,
          requester_substack_url,
          message,
          requested_date,
          status,
          created_at
        `)
        .eq('requester_user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator details for each request
      const requestsWithCreators = await Promise.all(
        (data || []).map(async (request) => {
          const { data: creatorData } = await supabase
            .from('creators')
            .select('name, username, profile_image_url, substack_url')
            .eq('id', request.creator_id)
            .single();

          return {
            ...request,
            creator: creatorData,
          };
        })
      );

      setRequests(requestsWithCreators);
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      const { error } = await supabase
        .from('collab_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('requester_user_id', user?.id)
        .eq('status', 'pending');

      if (error) throw error;

      setRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: 'cancelled' } : r
      ));
      toast.success('Request cancelled successfully');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReschedule = (creatorUsername: string) => {
    navigate(`/${creatorUsername}`);
    toast.info('Please submit a new request with your preferred date');
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sent Requests</h1>
          <p className="text-muted-foreground">
            Track collaboration requests you've sent to other creators
          </p>
        </div>

        {requests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No sent requests yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                When you request collaborations with other creators, they'll appear here.
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                Discover Creators
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => {
              const status = statusVariants[request.status] || statusVariants.pending;
              
              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.creator?.profile_image_url || undefined} />
                          <AvatarFallback>
                            {request.creator?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">
                            {request.creator?.name || 'Unknown Creator'}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            @{request.creator?.username || 'unknown'}
                            {request.creator?.substack_url && (
                              <a
                                href={request.creator.substack_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center ml-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {request.message && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        "{request.message}"
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {request.requested_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Requested: {format(new Date(request.requested_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          Sent {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Send className="h-4 w-4" />
                        <span>{request.requester_email}</span>
                      </div>
                    </div>

                    {/* Action buttons for pending requests */}
                    {request.status === 'pending' && (
                      <div className="flex gap-2 pt-3 border-t mt-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={cancellingId === request.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel Request
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel your collaboration request with {request.creator?.name}. 
                                You can always submit a new request later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Request</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelRequest(request.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Cancel Request
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => request.creator?.username && handleReschedule(request.creator.username)}
                        >
                          <CalendarClock className="h-4 w-4 mr-1" />
                          Reschedule
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
