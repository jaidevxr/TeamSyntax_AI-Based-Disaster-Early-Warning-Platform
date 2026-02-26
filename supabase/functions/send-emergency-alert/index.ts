import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GOOGLE_APPS_SCRIPT_URL = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
const FROM_NAME = Deno.env.get("ALERTS_FROM_NAME") || "Saarthi Emergency Alert";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmergencyAlertRequest {
  contacts: Array<{ name: string; email: string }>;
  userName: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: string;
  timestamp: string;
  nearbyDisasters?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      contacts,
      userName,
      location,
      status,
      timestamp,
      nearbyDisasters,
    }: EmergencyAlertRequest = await req.json();

    // Sanitize and deduplicate contacts by valid email
    const emailRegex = /^[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
    const sanitizedContacts = (contacts || [])
      .map(c => ({
        name: (c.name || '').toString().trim() || 'Contact',
        email: (c.email || '').toString().trim().toLowerCase(),
      }))
      .filter(c => !!c.email);

    const invalidRecipients = sanitizedContacts
      .filter(c => !emailRegex.test(c.email))
      .map(c => c.email);

    // unique by email
    const targetContacts = Array.from(
      new Map(sanitizedContacts.filter(c => emailRegex.test(c.email)).map(c => [c.email, c])).values()
    );

    console.log(`Sending emergency alert from ${userName} to ${targetContacts.length} contacts (invalid: ${invalidRecipients.length})`);

    const googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    
    const disasterInfo = nearbyDisasters && nearbyDisasters.length > 0
      ? `<div style="margin-top: 20px; padding: 15px; background-color: #fee; border-left: 4px solid #f44;">
           <h3 style="margin: 0 0 10px 0; color: #c33;">⚠️ Nearby Disasters:</h3>
           <ul style="margin: 0; padding-left: 20px;">
             ${nearbyDisasters.map(d => `<li>${d}</li>`).join('')}
           </ul>
         </div>`
      : '';

    // Send emails to all valid contacts
    if (targetContacts.length === 0) {
      console.warn('No valid contacts with emails to send.');
      return new Response(
        JSON.stringify({
          success: false,
          sent: 0,
          failed: 0,
          invalid: invalidRecipients,
          message: 'No valid contact emails to send.'
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Ensure email service configured
    if (!GOOGLE_APPS_SCRIPT_URL) {
      console.error("GOOGLE_APPS_SCRIPT_URL is not configured in Supabase function secrets.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please set GOOGLE_APPS_SCRIPT_URL in Supabase function secrets."
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailPromises = targetContacts.map(async (contact) => {
      console.log(`Sending email to ${contact.name} (${contact.email})`);
      
      const emailPayload = {
        to: contact.email,
        fromName: FROM_NAME,
        subject: `🚨 EMERGENCY ALERT from ${userName}`,
        text: `Emergency status: ${status}. Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${location.address ? ` - ${location.address}` : ''}. Map: ${googleMapsLink}. Time: ${new Date(timestamp).toLocaleString()}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">🚨 EMERGENCY ALERT</h1>
              </div>
              
              <div style="background: white; padding: 30px; border: 2px solid #667eea; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 18px; font-weight: bold; color: #c33; margin-top: 0;">
                  Dear ${contact.name},
                </p>
                
                <p style="font-size: 16px;">
                  <strong>${userName}</strong> has sent you an emergency alert through Saarthi.
                </p>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="margin-top: 0; color: #667eea;">Current Status:</h2>
                  <p style="font-size: 18px; margin: 10px 0;"><strong>${status}</strong></p>
                  
                  <h3 style="color: #667eea; margin-top: 20px;">📍 Location:</h3>
                  <p style="margin: 5px 0;">
                    Latitude: ${location.lat.toFixed(6)}<br>
                    Longitude: ${location.lng.toFixed(6)}
                    ${location.address ? `<br>Address: ${location.address}` : ''}
                  </p>
                  
                  <p style="margin: 15px 0;">
                    <a href="${googleMapsLink}" 
                       style="display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                      📍 View on Google Maps
                    </a>
                  </p>
                  
                  <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    Time: ${new Date(timestamp).toLocaleString()}
                  </p>
                </div>
                
                ${disasterInfo}
                
                <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px;">
                  <p style="margin: 0; color: #856404;">
                    <strong>⚠️ Please respond immediately</strong><br>
                    If you are able to help, please contact ${userName} as soon as possible.
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="font-size: 12px; color: #999; text-align: center; margin-bottom: 0;">
                  This emergency alert was sent via Saarthi - Disaster Management System<br>
                  If you received this in error, please disregard this message.
                </p>
              </div>
            </body>
          </html>
        `
      };

      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload)
        });

        if (!response.ok) {
          throw new Error(`Google Apps Script returned ${response.status}`);
        }

        const result = await response.json();
        return { status: 'fulfilled' as const, value: result };
      } catch (error) {
        console.error(`Failed to send email to ${contact.email}:`, error);
        return { status: 'rejected' as const, reason: error };
      }
    });

    console.log(`Attempting to send ${emailPromises.length} emergency emails`);
    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    // Log failed emails for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send email to ${targetContacts[index].name} (${targetContacts[index].email}):`, result.reason);
      } else {
        console.log(`Successfully sent email to ${targetContacts[index].name} (${targetContacts[index].email})`);
      }
    });

    console.log(`Emergency alerts sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        attempted: targetContacts.length,
        invalid: invalidRecipients,
        message: `Emergency alert sent to ${successful} of ${targetContacts.length} contacts` ,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-emergency-alert function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
