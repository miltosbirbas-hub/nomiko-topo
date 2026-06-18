// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: notify-signup
// Στέλνει email στον admin (brb.develop@gmail.com) σε κάθε νέα εγγραφή.
// Καλείται από Database Webhook στο auth.users (INSERT).
//
// DEPLOY:
//   supabase functions deploy notify-signup --no-verify-jwt
//   (ή από το Dashboard → Edge Functions → New function)
//
// SECRETS (Dashboard → Edge Functions → Manage secrets):
//   RESEND_API_KEY   = το κλειδί Resend (re_...)
//   ADMIN_EMAIL      = brb.develop@gmail.com
//   FROM_EMAIL       = no-reply@nomikotopo.gr  (επαληθευμένο domain στο Resend)
//   WEBHOOK_SECRET   = ένα τυχαίο string (ίδιο με το header του webhook)
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    // 1) Απλός έλεγχος μυστικού (ώστε να μην καλείται από οπουδήποτε)
    const secret = Deno.env.get("WEBHOOK_SECRET") || "";
    if (secret) {
      const got = req.headers.get("x-webhook-secret") || "";
      if (got !== secret) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      }
    }

    const payload = await req.json();
    // Το Supabase webhook στέλνει: { type, table, record, old_record, schema }
    const rec = payload?.record || {};
    const email = rec.email || "(άγνωστο email)";
    const created = rec.created_at || new Date().toISOString();
    const fullName =
      (rec.raw_user_meta_data && (rec.raw_user_meta_data.full_name || rec.raw_user_meta_data.name)) ||
      "(δεν δόθηκε όνομα)";
    const provider =
      (rec.raw_app_meta_data && rec.raw_app_meta_data.provider) || "email";

    const RESEND = Deno.env.get("RESEND_API_KEY");
    // Πολλαπλοί παραλήπτες: ADMIN_EMAIL μπορεί να είναι λίστα χωρισμένη με κόμμα.
    const adminRaw = Deno.env.get("ADMIN_EMAIL") || "brb.develop@gmail.com,miltos.birbas@gmail.com";
    const ADMIN = adminRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const FROM = Deno.env.get("FROM_EMAIL") || "no-reply@nomikotopo.gr";

    if (!RESEND) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500 });
    }

    const subject = `🆕 Νέα εγγραφή — ΝΟΜΙΚΟ ΤΟΠΟ: ${email}`;
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#1E3A5A;line-height:1.6">
        <h2 style="margin:0 0 12px">🆕 Νέο μέλος στο ΝΟΜΙΚΟ ΤΟΠΟ</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b6657">Email:</td><td><b>${email}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b6657">Όνομα:</td><td>${fullName}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b6657">Μέθοδος:</td><td>${provider}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b6657">Ημ/νία:</td><td>${created}</td></tr>
        </table>
        <p style="margin-top:16px;color:#6b6657;font-size:13px">Αυτόματη ειδοποίηση από nomikotopo.gr</p>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ΝΟΜΙΚΟ ΤΟΠΟ <${FROM}>`,
        to: ADMIN,
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: "resend_failed", detail: txt }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
