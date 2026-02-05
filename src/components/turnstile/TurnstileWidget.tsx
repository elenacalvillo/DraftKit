 import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";
 
 // Cloudflare Turnstile site key - NO FALLBACK in production to catch misconfig
 const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
 
 // Dev-only logging
 if (import.meta.env.DEV && TURNSTILE_SITE_KEY) {
   console.log(`[Turnstile] Site key prefix: ${TURNSTILE_SITE_KEY.slice(0, 8)}... | Host: ${window.location.hostname}`);
 }

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
   theme = 'auto',
   size = 'flexible',
   appearance = 'interaction-only',
   className = '',
 }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
   const [loadError, setLoadError] = useState<string | null>(null);
  
  // Store callbacks in refs to prevent effect re-runs
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  
  // Update refs when props change (no effect re-run)
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
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

  useEffect(() => {
    let mounted = true;

    const initWidget = async () => {
       // Check site key is configured
       if (!TURNSTILE_SITE_KEY) {
         const err = 'Turnstile site key not configured';
         console.error('[Turnstile]', err);
         setLoadError(err);
         onErrorRef.current?.();
         return;
       }
 
       try {
         await loadTurnstileScript();
       } catch (err) {
         if (!mounted) return;
         const errMsg = err instanceof Error ? err.message : 'Script load failed';
         console.error('[Turnstile]', errMsg);
         setLoadError(errMsg);
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
        sitekey: TURNSTILE_SITE_KEY,
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
  }, [theme, size, appearance]); // Only re-run on config changes, not callbacks

   // Show error state if script failed
   if (loadError) {
     return (
       <div className={`min-h-[65px] flex items-center justify-center text-sm text-muted-foreground ${className}`}>
         <span className="text-destructive">⚠️ Security check unavailable</span>
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
