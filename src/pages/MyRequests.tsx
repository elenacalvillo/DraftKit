import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Calendar, Clock, ExternalLink, Inbox, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

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
};

export default function MyRequests() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
