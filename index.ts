// Edge Function: analyze-drawing
// Κρατάει το Claude API key κρυφό στον server.
// Ο browser στέλνει το σχέδιο, η function καλεί το Claude, επιστρέφει το αποτέλεσμα.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*", // βάλε "https://hexis-app.gr" σε production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // 1. Πάρε το payload από τον browser
    const { system, content } = await req.json();
    if (!system || !content) {
      return new Response(JSON.stringify({ error: "Λείπουν δεδομένα (system/content)" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 2. Διάβασε το κρυφό Claude κλειδί από τα secrets
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Δεν έχει ρυθμιστεί το ANTHROPIC_API_KEY στα secrets" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 3. Κάλεσε το Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await claudeRes.json();
    if (!claudeRes.ok) {
      return new Response(JSON.stringify({ error: "Claude API: " + JSON.stringify(data) }), {
        status: claudeRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 4. Επίστρεψε μόνο το κείμενο
    const text = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    return new Response(JSON.stringify({ text, stop_reason: data.stop_reason || null }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
