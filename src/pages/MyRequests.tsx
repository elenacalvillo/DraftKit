import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { parseDateString, sanitizeSubstackImageUrl } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Calendar, Clock, ExternalLink, Inbox, ArrowRight, X, CalendarClock, Trash2, MessageSquare, PenLine, Eye, EyeOff } from 'lucide-react';
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
import { GuestMessageModal } from '@/components/requests/GuestMessageModal';
import { CollabImpactCard } from '@/components/requests/CollabImpactCard';

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
  collab_link: string | null;
  shared_content: string | null;
  content_last_edited_by: string | null;
  content_last_edited_at: string | null;
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
  published: { label: '✨ Published', variant: 'default' },
};

interface SuggestedCreator {
  id: string;
  name: string | null;
  username: string | null;
  profile_image_url: string | null;
  bio: string | null;
}

interface SharedWorkspace {
  request_id: string;
  role: string | null;
  joined_at: string | null;
  status: string;
  is_project_workspace: boolean;
  project_id: string | null;
  content_last_edited_at: string | null;
  content_last_edited_by: string | null;
  host_name: string | null;
  host_username: string | null;
  host_profile_image_url: string | null;
}

export default function MyRequests() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<SharedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [messageModalRequest, setMessageModalRequest] = useState<SentRequest | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [suggestedCreators, setSuggestedCreators] = useState<SuggestedCreator[]>([]);

  useEffect(() => {
    if (user) {
      fetchSentRequests();
      fetchSharedWorkspaces();
      fetchSuggestedCreators();
    }
  }, [user]);

  const fetchSharedWorkspaces = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('workspace_collaborators')
        .select('request_id, role, joined_at')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setSharedWorkspaces([]);
        return;
      }

      const ids = data.map((r) => r.request_id);
      const { data: reqs } = await supabase
        .from('collab_requests')
        .select('id, creator_id, status, is_project_workspace, project_id, content_last_edited_at, content_last_edited_by, requester_user_id')
        .in('id', ids);

      const byId = new Map((reqs || []).map((r) => [r.id, r]));

      const creatorIds = Array.from(new Set((reqs || []).map((r) => r.creator_id)));
      const { data: hosts } = await supabase
        .from('public_creator_profiles')
        .select('id, name, username, profile_image_url')
        .in('id', creatorIds);
      const hostById = new Map((hosts || []).map((h) => [h.id, h]));

      const rows: SharedWorkspace[] = data
        .map((wc) => {
          const req = byId.get(wc.request_id);
          if (!req) return null;
          if (req.status === 'cancelled' || req.status === 'declined') return null;
          // If user is already the requester, they'll see it in the proposals list
          if (req.requester_user_id === user.id) return null;
          const host = hostById.get(req.creator_id);
          return {
            request_id: wc.request_id,
            role: wc.role,
            joined_at: wc.joined_at,
            status: req.status,
            is_project_workspace: req.is_project_workspace,
            project_id: req.project_id,
            content_last_edited_at: req.content_last_edited_at,
            content_last_edited_by: req.content_last_edited_by,
            host_name: host?.name ?? null,
            host_username: host?.username ?? null,
            host_profile_image_url: host?.profile_image_url ?? null,
          } as SharedWorkspace;
        })
        .filter((r): r is SharedWorkspace => r !== null);

      setSharedWorkspaces(rows);
    } catch (err) {
      console.error('Error fetching shared workspaces:', err);
    }
  };

  const fetchSuggestedCreators = async () => {
    try {
      const { data } = await supabase
        .from('public_creator_profiles')
        .select('id, name, username, profile_image_url, bio')
        .not('id', 'is', null)
        .not('username', 'is', null)
        .limit(20);
      
      if (data) {
        // Filter out current user and pick 5 random
        const filtered = data.filter(c => c.id !== user?.id);
        const shuffled = filtered.sort(() => Math.random() - 0.5);
        setSuggestedCreators(shuffled.slice(0, 5));
      }
    } catch (err) {
      console.error('Error fetching suggested creators:', err);
    }
  };

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
          created_at,
          collab_link,
          shared_content,
          content_last_edited_by,
          content_last_edited_at,
          is_solo
        `)
        .eq('requester_user_id', user?.id)
        .eq('hidden_by_requester', false)
        .eq('is_solo', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator details for each request using public view (excludes sensitive email)
      const requestsWithCreators = await Promise.all(
        (data || []).map(async (request) => {
          const { data: creatorData } = await supabase
            .from('public_creator_profiles')
            .select('name, username, profile_image_url, substack_url')
            .eq('id', request.creator_id)
            .maybeSingle();

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
        .in('status', ['pending', 'approved']);

      if (error) throw error;

      setRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: 'cancelled' } : r
      ));
      toast.success('Request cancelled successfully');

      // Notify the host (creator) that the guest cancelled
      supabase.functions.invoke('send-collab-email', {
        body: { type: 'request_cancelled_by_guest', requestId }
      }).catch(err => console.error('Failed to send cancellation email:', err));
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

  const handleDeleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('collab_requests')
        .update({ hidden_by_requester: true })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Request deleted');
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Proposals</h1>
            <p className="text-muted-foreground">
              Track proposals you've sent to other creators
            </p>
          </div>
          {requests.some(r => r.status === 'declined' || r.status === 'cancelled') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="shrink-0 text-muted-foreground"
            >
              {showAll ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showAll ? 'Hide Declined' : 'Show All'}
            </Button>
          )}
        </div>

        {(() => {
          const filtered = showAll
            ? requests
            : requests.filter(r => r.status !== 'declined' && r.status !== 'cancelled');
          return filtered.length === 0 ? (
          <>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
               <h3 className="font-semibold text-lg mb-1">No proposals yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                When you propose collaborations with other creators, they'll appear here.
              </p>
              <Button onClick={() => navigate('/dashboard/discovery')} variant="outline">
                Explore Network
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {suggestedCreators.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Creators to Collaborate With</h3>
              <div className="grid gap-3">
                {suggestedCreators.map((creator) => (
                  <Card key={creator.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center gap-4 py-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={creator.profile_image_url ? sanitizeSubstackImageUrl(creator.profile_image_url) : undefined} />
                        <AvatarFallback>
                          {creator.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{creator.name}</p>
                        {creator.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{creator.bio}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/${creator.username}`)}
                      >
                        View Profile
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="grid gap-4">
            {filtered.map((request) => {
              const status = statusVariants[request.status] || statusVariants.pending;
              
              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.creator?.profile_image_url ? sanitizeSubstackImageUrl(request.creator.profile_image_url) : undefined} />
                          <AvatarFallback>
                            {request.creator?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-lg break-words">
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
                            Requested: {format(parseDateString(request.requested_date), 'MMM d, yyyy')}
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
                        <span>You</span>
                      </div>
                    </div>

                    {/* Action buttons for pending or approved requests */}
                    {(request.status === 'pending' || request.status === 'approved') && (
                      <div className="flex gap-2 pt-3 border-t mt-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={cancellingId === request.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              {request.status === 'approved' ? 'Cancel Collab' : 'Cancel Request'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {request.status === 'approved' ? 'Cancel this collaboration?' : 'Cancel this request?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {request.status === 'approved'
                                  ? `This will cancel your approved collaboration with ${request.creator?.name}. The workspace content will be preserved but editing will be locked.`
                                  : `This will cancel your collaboration request with ${request.creator?.name}. You can always submit a new request later.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{request.status === 'approved' ? 'Keep Collab' : 'Keep Request'}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelRequest(request.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {request.status === 'approved' ? 'Cancel Collab' : 'Cancel Request'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {request.status === 'pending' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => request.creator?.username && handleReschedule(request.creator.username)}
                          >
                            <CalendarClock className="h-4 w-4 mr-1" />
                            Reschedule
                          </Button>
                        )}
                      </div>
                    )}

                    {(request.status === 'approved' || request.status === 'published') && (
                      <div className="space-y-3 pt-3 border-t mt-3">
                        {request.status === 'published' && (
                          <CollabImpactCard
                            requestId={request.id}
                            creatorName={request.creator?.name}
                            requesterName={request.requester_name}
                          />
                        )}
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
                        >
                          <PenLine className="h-4 w-4 mr-2" />
                          {request.status === 'published' ? 'View Published Work' : 'Enter Workspace'}
                        </Button>

                        {(request.status === 'approved' || request.status === 'published') && (
                          <div className="flex gap-2">
                            {request.collab_link && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(request.collab_link!, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                {request.status === 'published' ? 'See Live Post' : 'Open External Document'}
                              </Button>
                            )}
                            {request.status === 'approved' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setMessageModalRequest(request)}
                              >
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Message {request.creator?.name?.split(' ')[0] || 'Creator'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete button for cancelled requests */}
                    {request.status === 'cancelled' && (
                      <div className="flex gap-2 pt-3 border-t mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteRequest(request.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Dismiss"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
        })()}

        {sharedWorkspaces.length > 0 && (
          <div className="pt-4">
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Shared with me</h2>
              <p className="text-sm text-muted-foreground">
                Workspaces you've been invited to collaborate on
              </p>
            </div>
            <div className="grid gap-3">
              {sharedWorkspaces.map((w) => (
                <Card key={w.request_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center gap-4 py-4">
                    <Avatar className="h-11 w-11">
                      <AvatarImage
                        src={w.host_profile_image_url ? sanitizeSubstackImageUrl(w.host_profile_image_url) : undefined}
                      />
                      <AvatarFallback>{w.host_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {w.host_name || 'Workspace host'}
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {w.is_project_workspace ? 'Project' : (w.role || 'Collaborator')}
                        </Badge>
                        {w.status === 'published' && (
                          <Badge variant="default">✨ Published</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {w.content_last_edited_at
                          ? `Last edited ${formatDistanceToNow(new Date(w.content_last_edited_at), { addSuffix: true })}${w.content_last_edited_by ? ` by ${w.content_last_edited_by}` : ''}`
                          : w.joined_at
                            ? `Joined ${formatDistanceToNow(new Date(w.joined_at), { addSuffix: true })}`
                            : 'Invited collaborator'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/dashboard/workspace/${w.request_id}`)}
                    >
                      <PenLine className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}



        {/* Guest Message Modal */}
        {messageModalRequest && (
          <GuestMessageModal
            open={!!messageModalRequest}
            onOpenChange={(open) => !open && setMessageModalRequest(null)}
            requestId={messageModalRequest.id}
            creatorName={messageModalRequest.creator?.name || 'Creator'}
            senderEmail={messageModalRequest.requester_email}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
