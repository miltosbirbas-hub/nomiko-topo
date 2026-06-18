# Ειδοποίηση email σε νέα εγγραφή — Οδηγίες εγκατάστασης

Στόχος: κάθε φορά που γράφεται νέος χρήστης, να έρχεται email στο
**brb.develop@gmail.com** μέσω Resend (που ήδη έχεις στημένο).

Δύο κομμάτια: (Α) η Edge Function `notify-signup`, (Β) το Database Webhook
που την καλεί όταν μπαίνει νέα γραμμή στο `auth.users`.

---

## Α. Edge Function

1. Στο Supabase Dashboard του project `cjeeiatkphrmoalxlbze`:
   **Edge Functions → Deploy a new function** (ή με CLI).
   Όνομα: `notify-signup`. Επικόλλησε το περιεχόμενο του `notify-signup.ts`.

   Με CLI:
   ```
   supabase functions deploy notify-signup --no-verify-jwt
   ```
   (το `--no-verify-jwt` χρειάζεται γιατί ο webhook δεν στέλνει user JWT —
   την ασφάλεια την κάνουμε με το WEBHOOK_SECRET παρακάτω)

2. **Secrets** (Edge Functions → Manage secrets), πρόσθεσε:
   ```
   RESEND_API_KEY  = re_...            (το κλειδί Resend σου)
   ADMIN_EMAIL     = brb.develop@gmail.com,miltos.birbas@gmail.com
   FROM_EMAIL      = no-reply@nomikotopo.gr   (ή ό,τι domain έχεις επαληθεύσει στο Resend)
   WEBHOOK_SECRET  = <βάλε ένα τυχαίο string, π.χ. 32 χαρακτήρες>
   ```
   (Το ADMIN_EMAIL δέχεται πολλά email χωρισμένα με κόμμα — η ειδοποίηση
    πάει σε όλα. Αν δεν βάλεις secret, χρησιμοποιούνται και τα δύο default.)
   ⚠ Το `FROM_EMAIL` πρέπει να είναι σε **επαληθευμένο domain** στο Resend.
   Αν έχεις ήδη επαληθεύσει το nomikotopo.gr ή birbas.gr, χρησιμοποίησέ το.

---

## Β. Database Webhook (auth.users → INSERT)

1. Dashboard → **Database → Webhooks → Create a new hook**.
2. Ρυθμίσεις:
   - **Name:** `on_new_signup`
   - **Table:** `auth.users`  (επίλεξε schema `auth`, table `users`)
   - **Events:** μόνο **Insert**
   - **Type:** Supabase Edge Function (ή HTTP Request)
   - **Edge Function:** `notify-signup`  (ή URL:
     `https://cjeeiatkphrmoalxlbze.supabase.co/functions/v1/notify-signup`)
   - **HTTP Headers** → πρόσθεσε:
     ```
     x-webhook-secret : <ΤΟ ΙΔΙΟ string με το WEBHOOK_SECRET>
     ```
3. Save.

---

## Δοκιμή

- Κάνε μια δοκιμαστική εγγραφή στο nomikotopo.gr (ή από Authentication → Add user).
- Σε λίγα δευτερόλεπτα θα έρθει email στο brb.develop@gmail.com **και** στο
  miltos.birbas@gmail.com με τα στοιχεία.
- Αν δεν έρθει: Edge Functions → notify-signup → **Logs** για να δεις το σφάλμα
  (συνήθως: μη επαληθευμένο FROM_EMAIL ή λάθος RESEND_API_KEY).

---

## Σημείωση
Αν δεν έχεις επαληθευμένο domain στο Resend ακόμα, προσωρινά μπορείς να
βάλεις `FROM_EMAIL = onboarding@resend.dev` (το test domain του Resend) —
δουλεύει μόνο για αποστολή προς το δικό σου επαληθευμένο email.
