import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CollabDraft } from "@/lib/storage";

// Extend window for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: ErrorResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface ErrorResponse {
  type: string;
  message?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

// The Google Client ID from environment (set via secrets)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

// Required scope for creating Google Docs
const DOCS_SCOPE = "https://www.googleapis.com/auth/documents";

interface UseGoogleDocsReturn {
  isLoading: boolean;
  error: string | null;
  isGisLoaded: boolean;
  createGoogleDoc: (draft: CollabDraft, requesterName: string) => Promise<string | null>;
}

export function useGoogleDocs(): UseGoogleDocsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  // Check if GIS SDK is loaded
  useEffect(() => {
    const checkGisLoaded = () => {
      if (window.google?.accounts?.oauth2) {
        setIsGisLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGisLoaded()) return;

    // Poll for GIS SDK to load
    const interval = setInterval(() => {
      if (checkGisLoaded()) {
        clearInterval(interval);
      }
    }, 100);

    // Stop polling after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!window.google?.accounts?.oauth2) {
        console.warn("Google Identity Services SDK failed to load");
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const createGoogleDoc = useCallback(
    async (draft: CollabDraft, requesterName: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      // Check if GIS is available
      if (!window.google?.accounts?.oauth2) {
        setError("Google services not available. Please try again later.");
        setIsLoading(false);
        return null;
      }

      if (!GOOGLE_CLIENT_ID) {
        setError("Google OAuth is not configured.");
        setIsLoading(false);
        return null;
      }

      return new Promise((resolve) => {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DOCS_SCOPE,
          callback: async (tokenResponse: TokenResponse) => {
            if (tokenResponse.error) {
              setError(tokenResponse.error_description || "Authorization failed");
              setIsLoading(false);
              resolve(null);
              return;
            }

            try {
              // Call our edge function to create the document
              const { data, error: fnError } = await supabase.functions.invoke(
                "create-google-doc",
                {
                  body: {
                    accessToken: tokenResponse.access_token,
                    draft,
                    requesterName,
                  },
                }
              );

              if (fnError) {
                console.error("Edge function error:", fnError);
                setError("Failed to create document. Please try again.");
                setIsLoading(false);
                resolve(null);
                return;
              }

              if (data?.documentUrl) {
                setIsLoading(false);
                resolve(data.documentUrl);
              } else {
                setError("No document URL returned");
                setIsLoading(false);
                resolve(null);
              }
            } catch (err) {
              console.error("Error creating Google Doc:", err);
              setError("Failed to create document. Please try again.");
              setIsLoading(false);
              resolve(null);
            }
          },
          error_callback: (errorResponse: ErrorResponse) => {
            console.error("OAuth error:", errorResponse);
            if (errorResponse.type === "popup_closed") {
              setError("Authorization cancelled");
            } else {
              setError("Authorization failed. Please try again.");
            }
            setIsLoading(false);
            resolve(null);
          },
        });

        // Request access token (will show consent popup if needed)
        tokenClient.requestAccessToken({ prompt: "" });
      });
    },
    []
  );

  return {
    isLoading,
    error,
    isGisLoaded,
    createGoogleDoc,
  };
}
