 /// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 Deno.serve(async (req) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     // Read the public site key from environment
     const siteKey = Deno.env.get('VITE_TURNSTILE_SITE_KEY');
 
     if (!siteKey) {
       console.error('[turnstile-config] VITE_TURNSTILE_SITE_KEY not configured in environment');
       return new Response(
         JSON.stringify({ 
           siteKey: null, 
           error: 'Turnstile site key not configured',
           source: 'env_missing'
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     return new Response(
       JSON.stringify({ 
         siteKey,
         source: 'env'
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('[turnstile-config] Error:', error);
     return new Response(
       JSON.stringify({ 
         siteKey: null, 
         error: 'Internal server error',
         source: 'error'
       }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });