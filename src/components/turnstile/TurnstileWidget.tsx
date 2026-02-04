import { useEffect, useRef, useCallback } from "react";

// Cloudflare Turnstile test site key (always passes)
// Replace with real key for production
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

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
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  className?: string;
}

// Track if script is loading/loaded globally
let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded && window.turnstile) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (scriptLoading) {
      return;
    }

    scriptLoading = true;

    // Set global callback
    window.onTurnstileLoad = () => {
      scriptLoaded = true;
      scriptLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'invisible',
  appearance = 'always',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const handleVerify = useCallback((token: string) => {
    onVerify(token);
  }, [onVerify]);

  const handleError = useCallback(() => {
    onError?.();
  }, [onError]);

  const handleExpire = useCallback(() => {
    onExpire?.();
  }, [onExpire]);

  useEffect(() => {
    let mounted = true;

    const initWidget = async () => {
      await loadTurnstileScript();

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
  }, [handleVerify, handleError, handleExpire, theme, size, appearance]);

  return <div ref={containerRef} className={className} />;
}

// Hook for imperative control
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
