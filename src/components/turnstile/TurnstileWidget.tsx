 import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
 
// Error types for specific messaging
type TurnstileErrorType = 'config_missing' | 'script_blocked' | 'script_timeout' | 'fetch_error' | null;

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  onBypass?: (reason: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  className?: string;
 }
 
 // Script load state
 type ScriptState = 'idle' | 'loading' | 'loaded' | 'error';
 
 // Handle imperative reset from parent
 export interface TurnstileWidgetHandle {
   reset: () => void;
}

 // Track script load state globally
let scriptState: ScriptState = 'idle';
let scriptError: string | null = null;
const loadCallbacks: (() => void)[] = [];
 const errorCallbacks: ((error: string) => void)[] = [];

 function loadTurnstileScript(): Promise<void> {
   return new Promise((resolve, reject) => {
     if (scriptState === 'loaded' && window.turnstile) {
      resolve();
      return;
    }
     
     if (scriptState === 'error') {
       reject(new Error(scriptError || 'Script failed to load'));
       return;
     }

    loadCallbacks.push(resolve);
     errorCallbacks.push(reject);

     if (scriptState === 'loading') {
      return;
    }

     scriptState = 'loading';

    // Set global callback
    window.onTurnstileLoad = () => {
       scriptState = 'loaded';
       scriptError = null;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
       errorCallbacks.length = 0;
    };

    const script = document.createElement('script');
     script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;
     
     // Handle script load error
     script.onerror = () => {
       const err = 'Turnstile script blocked or failed to load. Check ad blockers or network.';
       scriptState = 'error';
       scriptError = err;
       errorCallbacks.forEach((cb) => cb(err));
       loadCallbacks.length = 0;
       errorCallbacks.length = 0;
     };
 
    document.head.appendChild(script);
 
     // Timeout after 8 seconds
     setTimeout(() => {
       if (scriptState === 'loading') {
         const err = 'Turnstile script timed out. Check ad blockers or network.';
         scriptState = 'error';
         scriptError = err;
         errorCallbacks.forEach((cb) => cb(err));
         loadCallbacks.length = 0;
         errorCallbacks.length = 0;
       }
     }, 8000);
  });
}

 export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget({
   onVerify,
   onError,
   onExpire,
  onBypass,
   theme = 'auto',
   size = 'flexible',
   appearance = 'interaction-only',
   className = '',
 }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<TurnstileErrorType>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Store callbacks in refs to prevent effect re-runs
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  const onBypassRef = useRef(onBypass);
  
  // Update refs when props change (no effect re-run)
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
    onBypassRef.current = onBypass;
  });
 
   // Expose reset method to parent
   useImperativeHandle(ref, () => ({
     reset: () => {
       if (widgetIdRef.current && window.turnstile) {
         try {
           window.turnstile.reset(widgetIdRef.current);
         } catch {
           // Ignore reset errors
         }
       }
     },
   }), []);

  // Stable callbacks that never change
  const handleVerify = useCallback((token: string) => {
    onVerifyRef.current(token);
  }, []);

  const handleError = useCallback(() => {
    onErrorRef.current?.();
  }, []);

  const handleExpire = useCallback(() => {
    onExpireRef.current?.();
  }, []);

  // Fetch site key from backend on mount
  useEffect(() => {
    let mounted = true;

    const fetchSiteKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('turnstile-config');
        
        if (!mounted) return;
        
        if (error) {
          console.error('[Turnstile] Config fetch error:', error);
          setErrorType('fetch_error');
          setIsLoading(false);
          onErrorRef.current?.();
          return;
        }
        
        if (!data?.siteKey) {
          console.error('[Turnstile] Site key not configured in backend');
          setErrorType('config_missing');
          setIsLoading(false);
          console.warn('Security bypassed due to load failure: config_missing');
          onBypassRef.current?.('config_missing');
          onErrorRef.current?.();
          return;
        }
        
        if (import.meta.env.DEV) {
          console.log(`[Turnstile] Site key fetched: ${data.siteKey.slice(0, 8)}... | Host: ${window.location.hostname}`);
        }
        
        setSiteKey(data.siteKey);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error('[Turnstile] Failed to fetch config:', err);
        setErrorType('fetch_error');
        setIsLoading(false);
        console.warn('Security bypassed due to load failure: fetch_error');
        onBypassRef.current?.('fetch_error');
        onErrorRef.current?.();
      }
    };

    fetchSiteKey();

    return () => {
      mounted = false;
    };
  }, []);

  // Initialize widget once we have the site key
  useEffect(() => {
    if (!siteKey) return;
    
    let mounted = true;

    const initWidget = async () => {
      try {
        await loadTurnstileScript();
      } catch (err) {
        if (!mounted) return;
        const errMsg = err instanceof Error ? err.message : 'Script load failed';
        console.error('[Turnstile]', errMsg);
        
        if (errMsg.includes('timed out')) {
          setErrorType('script_timeout');
          console.warn('Security bypassed due to load failure: script_timeout');
          onBypassRef.current?.('script_timeout');
        } else {
          setErrorType('script_blocked');
          console.warn('Security bypassed due to load failure: script_blocked');
          onBypassRef.current?.('script_blocked');
        }
        onErrorRef.current?.();
        return;
      }

      if (!mounted || !containerRef.current || !window.turnstile) {
        return;
      }

      // Clean up any existing widget
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore removal errors
        }
      }

      // Clear container
      containerRef.current.innerHTML = '';

      // Render new widget
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: handleVerify,
        'error-callback': handleError,
        'expired-callback': handleExpire,
        theme,
        size,
        appearance,
      });
    };

    initWidget();

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore removal errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size, appearance, handleVerify, handleError, handleExpire]);

  // Show loading state
  if (isLoading) {
    return (
      <div className={`min-h-[65px] flex items-center justify-center text-sm text-muted-foreground ${className}`}>
        <span>Loading security check...</span>
      </div>
    );
  }

  // Show specific error states
  if (errorType) {
    const errorMessages: Record<TurnstileErrorType & string, string> = {
      config_missing: '⚠️ Security check misconfigured',
      script_blocked: '⚠️ Security check blocked (ad blocker/network)',
      script_timeout: '⚠️ Security check timed out',
      fetch_error: '⚠️ Security check unavailable',
    };
    
    return (
      <div className={`min-h-[65px] flex items-center justify-center text-sm text-muted-foreground ${className}`}>
        <span className="text-destructive">{errorMessages[errorType]}</span>
      </div>
    );
  }

  return <div ref={containerRef} className={`min-h-[65px] ${className}`} />;
});

TurnstileWidget.displayName = 'TurnstileWidget';

// Hook for imperative control
// Deprecated - use ref.reset() instead
export function useTurnstileReset() {
  return useCallback((widgetId: string | null) => {
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
      } catch {
        // Ignore reset errors
      }
    }
  }, []);
}
