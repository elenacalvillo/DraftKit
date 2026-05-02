import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

interface Creator {
  id: string;
  user_id: string;
  username: string;
  name: string;
  substack_url: string | null;
  bio: string | null;
  welcome_message: string | null;
  newsletter_url: string | null;
  profile_image_url: string | null;
  collab_style: string | null;
  collab_guidelines: string | null;
  date_meaning: string | null;
  collab_mode: string | null;
  collab_vibe: string | null;
  collab_formats: string | null;
  reminder_days_before: number | null;
  profile_theme: Record<string, unknown> | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  creator: Creator | null;
  loading: boolean;
  creatorLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; data: { user: User | null } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshCreator: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorLoading, setCreatorLoading] = useState(false);

  const fetchCreator = async (userId: string) => {
    setCreatorLoading(true);
    try {
      const { data } = await supabase
        .from('creators')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      setCreator((data as Creator) ?? null);
    } finally {
      setCreatorLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchCreator(session.user.id);
          }, 0);
        } else {
          setCreator(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchCreator(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    return { 
      error: error ? new Error(error.message) : null, 
      data: data ? { user: data.user } : null 
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    
    if (result.redirected) {
      return { error: null };
    }
    
    return { error: result.error ? new Error(result.error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCreator(null);
  };

  const refreshCreator = async () => {
    if (user) {
      await fetchCreator(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      creator, 
      loading, 
      creatorLoading,
      signUp, 
      signIn, 
      signInWithGoogle,
      signOut,
      refreshCreator 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
