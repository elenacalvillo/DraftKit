import { supabase } from "@/integrations/supabase/client";

export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
   codes?: string[];
}

/**
 * Verify a Turnstile token with the backend
 */
export async function verifyTurnstileToken(token: string): Promise<TurnstileVerifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-turnstile', {
      body: { token },
    });

    if (error) {
      console.error('Turnstile verification error:', error);
      return { success: false, error: error.message };
    }

     return { 
       success: data?.success ?? false, 
       error: data?.error,
       codes: data?.codes,
     };
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return { success: false, error: 'Verification request failed' };
  }
}
