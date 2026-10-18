# Host for testing: Vercel (website) + Firebase (database, login, photos)

Vercel serves the pages. Firebase stores the data. `server.js` is only for local testing and is NOT used on Vercel.
(Vercel cannot keep files or sessions, so a Vercel site needs a separate database; this project uses Firebase.)

## Part A: Firebase (the database)  ~15 min
1. https://console.firebase.google.com → **Add project** (name e.g. `gharkul-test`). Google Analytics: off.
2. **Build → Firestore Database → Create database** → *Production mode* → location **asia-south1 (Mumbai)**.
3. **Build → Authentication → Get started → Email/Password → Enable → Save.**
4. **Build → Storage → Get started.** New Firebase projects must be on the pay-as-you-go **Blaze** plan to use Storage
   (it has a free tier, but a billing account is required). Set a **budget alert** (Billing → Budgets) e.g. ₹500.
5. **Rules** (paste, then Publish):
   - Firestore Database → Rules → paste everything from `firestore.rules`
   - Storage → Rules → paste everything from `storage.rules`
6. **Authentication → Users → Add user:** your owner email + a long unique password.
7. **Project settings (gear) → General → Your apps → Web `</>`** → register app → copy `firebaseConfig`
   into `js/config.js` (replace the `YOUR_...` values). Use the `storageBucket` exactly as Firebase shows it.
8. **Give your user the owner role** (on your laptop, in this folder):
   - Project settings → **Service accounts → Generate new private key** → save as `serviceAccountKey.json` in this folder (never upload it).
   - ```
     npm i firebase-admin
     node scripts/setOwnerClaim.js your-owner-email@example.com
     ```
9. **Restrict the API key:** Google Cloud Console → APIs & Services → Credentials → the *Browser key* →
   Application restrictions: *Websites* → add `https://YOUR-SITE.vercel.app/*` and `http://localhost:*/*`.

## Part B: Vercel (the website)  ~10 min
Vercel deploys from Git (or its command line). Easiest: GitHub.
1. Create a free GitHub account → **New repository** (set it **Private**).
2. **Add file → Upload files** → drag in the *contents* of this folder (not `serviceAccountKey.json`, not `data/`). Commit.
3. https://vercel.com → **Sign up with GitHub** → **Add New → Project** → pick the repo → **Import**.
4. Framework Preset: **Other**. Build Command: *empty*. Output Directory: **.** (a dot). → **Deploy**.
5. Copy your address, e.g. `https://gharkul-test.vercel.app`.
6. Back in Firebase → **Authentication → Settings → Authorized domains → Add domain** → `gharkul-test.vercel.app`.
7. Edit step 9's API-key restriction to use that exact address.

(Without GitHub: install Node, then in this folder run `npx vercel` and follow the prompts; `npx vercel --prod` to publish.)

## Part C: First test (do in this order)
1. Open `https://YOUR-SITE.vercel.app/owner.html` → sign in → badge should say **Live (Firebase)**.
2. Add a property with 2 photos. Add an announcement.
3. Open the public address on your phone: the property and photos must appear. (The site starts empty until you add data.)
4. Book an appointment on the phone → it appears under **Appointments** in the owner page.
5. Open the Activity log tab → your actions are listed.
6. Security checks: open the site in a private window and try `owner.html` login with a wrong password (must fail with the generic message);
   in Firebase → Firestore → Rules → **Rules Playground**, simulate an unauthenticated **read of /appointments/x** (must be denied)
   and an unauthenticated **write to /properties/x** (must be denied).
7. Press F12 → Console on `owner.html`: the owner page sends a *Report-Only* CSP. If the console shows no "violates Content Security Policy" lines,
   rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `vercel.json` to enforce it.

## Honest limits of this test setup
- The live (Firebase) path was written but I could not test it against a real Firebase project here. Parts A–C are the real test; tell me exactly what fails.
- **Two-factor login is built only for the local test server.** On Vercel + Firebase the owner login is password-only, plus the lockout, idle logout, server-side rules and audit log.
  Until 2FA is added, use a very long password and do not share the `owner.html` address. Options: Firebase multi-factor (needs the Identity Platform upgrade) or Cloudflare Access in front of the owner page.
- `owner.html` is on the same domain as the public site here. For the real launch, host it on its own subdomain (see SECURITY-SETUP.md).
- Check Vercel's current plan terms: the free Hobby plan is meant for personal, non-commercial use.
- PostgreSQL is not used; Firestore is the database in this project.
