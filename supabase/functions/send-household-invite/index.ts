import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { inviteeEmail, inviterName } = await req.json();

    if (!inviteeEmail) {
      return new Response(JSON.stringify({ error: "Missing inviteeEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(inviteeEmail)) {
      return new Response(
        JSON.stringify({ error: `Invalid email address: "${inviteeEmail}". Please check for typos.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderLabel = inviterName || user.email || "A PROTOCOL Guardian user";
    const allowedOrigins = ["https://superhumanprotocol.lovable.app", "http://localhost:5173", "http://localhost:8080"];
    const requestOrigin = req.headers.get("origin") || "";
    const appUrl = allowedOrigins.includes(requestOrigin) ? requestOrigin : "https://superhumanprotocol.lovable.app";

    // Always try inviteUserByEmail first — it sends an actual email for new users
    console.log(`Attempting invite for ${inviteeEmail} from ${senderLabel}`);

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      inviteeEmail,
      {
        redirectTo: `${appUrl}/`,
        data: {
          invited_by: user.id,
          invited_by_name: senderLabel,
        },
      }
    );

    if (!inviteError) {
      console.log(`inviteUserByEmail succeeded for ${inviteeEmail}`);
      return new Response(
        JSON.stringify({
          success: true,
          emailSent: true,
          newUser: true,
          message: "Invitation email sent to new user",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If invite failed (e.g. user already exists), try sending a magic link via OTP
    console.log(`inviteUserByEmail failed: ${inviteError.message}. Trying OTP magic link...`);

    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email: inviteeEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appUrl}/`,
      },
    });

    if (otpError) {
      console.error(`OTP magic link also failed: ${otpError.message}`);
      return new Response(
        JSON.stringify({
          success: true,
          emailSent: false,
          note: "Invite created in-app but email could not be sent: " + otpError.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`OTP magic link sent to existing user ${inviteeEmail}`);
    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        existingUser: true,
        message: "Login link sent to existing user",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-household-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
