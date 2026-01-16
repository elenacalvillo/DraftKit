import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily collaboration reminder check...");

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Today's date: ${todayStr}`);

    // Fetch all approved requests where:
    // - requested_date is in the future
    // - reminder_sent_at is NULL (not already reminded)
    const { data: requests, error: fetchError } = await supabase
      .from("collab_requests")
      .select(`
        id,
        requested_date,
        reminder_sent_at,
        creators (
          id,
          name,
          email,
          reminder_days_before
        )
      `)
      .eq("status", "approved")
      .is("reminder_sent_at", null)
      .not("requested_date", "is", null)
      .gte("requested_date", todayStr);

    if (fetchError) {
      console.error("Error fetching requests:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${requests?.length || 0} approved requests without reminders`);

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders to send", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const request of requests) {
      const requestedDate = new Date(request.requested_date);
      const reminderDaysBefore = (request.creators as any)?.reminder_days_before ?? 3;
      
      // Calculate the reminder date
      const reminderDate = new Date(requestedDate);
      reminderDate.setDate(reminderDate.getDate() - reminderDaysBefore);
      
      // Check if today is on or after the reminder date
      if (today >= reminderDate) {
        console.log(`Sending reminder for request ${request.id} (collab on ${request.requested_date}, reminder ${reminderDaysBefore} days before)`);
        
        try {
          // Call the send-collab-email function with the reminder type
          const { error: emailError } = await supabase.functions.invoke('send-collab-email', {
            body: { 
              type: 'collab_reminder', 
              requestId: request.id 
            }
          });

          if (emailError) {
            console.error(`Failed to send reminder for request ${request.id}:`, emailError);
            continue;
          }

          // Mark the reminder as sent
          const { error: updateError } = await supabase
            .from("collab_requests")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", request.id);

          if (updateError) {
            console.error(`Failed to update reminder_sent_at for request ${request.id}:`, updateError);
          } else {
            sentCount++;
            console.log(`Successfully sent and recorded reminder for request ${request.id}`);
          }
        } catch (e) {
          console.error(`Error processing reminder for request ${request.id}:`, e);
        }
      } else {
        console.log(`Skipping request ${request.id} - reminder date not reached yet (${reminderDate.toISOString().split('T')[0]})`);
      }
    }

    console.log(`Reminder check complete. Sent ${sentCount} reminders.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} reminder emails`,
        count: sentCount 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-collab-reminder function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
