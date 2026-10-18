# Owner portal security

## Read this first: demo mode is NOT secure
Without Firebase keys the site runs in demo mode. The demo password sits in `js/config.js`
and data lives in the browser, so anyone who can open the files can read it.
Use demo mode only for trying the screens. A real owner portal needs live mode below.

## Two-factor login: where it exists
| Mode | 2FA |
|---|---|
| **Local test server** (`node server.js`, see TESTING.md) | **Built and tested.** Password + 6-digit authenticator code (TOTP), one-time recovery codes, replay protection, lock after 5 wrong codes. |
| Demo mode (files opened directly) | None. Browser-only, for looking at screens. |
| Live Firebase | Not built into the login screen yet. Use the gateway option below, or ask me to add Firebase MFA. |

Authenticator keys and recovery-code hashes are kept in `data/2fa.json` on the server computer (not served to browsers).

## What is built in (code in this folder)
| Protection | Where | Status |
|---|---|---|
| Owner = signed-in user with `owner` role, checked **on the server** (Firestore + Storage rules) | `firestore.rules`, `storage.rules` | Rules written; test after you deploy |
| Visitors can only *create* a visit request; cannot read anything private | `firestore.rules` | Written; test after deploy |
| Server-side field validation (types, lengths, max 10 photos, price range) | `firestore.rules` | Written; test after deploy |
| Photos: JPEG/PNG/WebP only, under 5 MB, only `properties/` and `announcements/` folders | `storage.rules` | Written; test after deploy |
| Append-only **Activity log** (login, logout, add/edit/delete) | `js/db.js`, `owner.html` tab | Tested in demo mode |
| Login lock after 5 wrong tries (15 min) | `js/owner.js` | Tested |
| Auto logout after 15 min idle or 8 h total | `js/owner.js`, `js/config.js` | Tested |
| Session ends when the tab closes | `js/db.js` | Tested in demo mode |
| Same error for every failed login (no account hints) | `js/db.js` | Tested in demo mode |
| Owner page not linked from the public site | `index.html` | Tested |
| Security headers (HSTS, CSP, no framing, no caching, no indexing) | `firebase.json` | Written; **CSP not browser-tested** |
| Owner portal on its **own subdomain**, not shipped with the public site | `firebase.json` targets | Written; test after deploy |
| App Check (blocks requests not coming from your real site) | `js/config.js` `appCheckSiteKey` | Optional; not tested |

The login lock and idle logout run in the browser, so they protect against casual misuse,
not a determined attacker. The real protection is the server-side rules plus the items in
"You must do" below.

## Go live (in this order)
1. Firebase Console: create a project. Enable **Authentication → Email/Password**, **Firestore**, **Storage**.
2. Project settings → Your apps → Web → paste the config into `js/config.js`.
3. Authentication → Users → add the owner with a **long unique password** (password manager).
4. Restrict the Web API key (Google Cloud → APIs & Services → Credentials) to your two domains.
5. Deploy rules: `firebase deploy --only firestore:rules,storage`
6. Give the owner the role: `npm i firebase-admin` then `node scripts/setOwnerClaim.js owner@email.com`
   (service-account key stays on your computer; `.gitignore` already excludes it).
7. Two hosting sites: `firebase target:apply hosting site <public-site-id>` and
   `firebase target:apply hosting manage <portal-site-id>`, then `firebase deploy --only hosting`.
   Point `www.yourdomain` at *site* and `manage.yourdomain` at *manage*.
8. Open the portal, log in, add one property. Then open the public site and confirm it appears.

## You must do (cannot be done from code in this folder)
- **Second factor for live Firebase hosting:** not in the login screen yet. Easiest strong option:
  Cloudflare Access / Google IAP in front of `manage.yourdomain` (enforces MFA before the page even loads).
  Firebase's own MFA needs the Identity Platform upgrade plus a code-entry step in `owner.js`.
- **Zero Trust gateway:** put `manage.yourdomain` behind Cloudflare Access or Google IAP and
  require your email + MFA there. This is the strongest single upgrade and needs no code.
- **DDoS/WAF:** put the domain behind Cloudflare (free tier is a good start).
- **Backups:** Firestore → Disaster recovery → schedule daily backups; test a restore once.
- **Bot protection:** register reCAPTCHA v3, paste the site key in `appCheckSiteKey`, enforce App Check.

## Not applicable to this stack
Argon2id and PostgreSQL belong to a custom server. This site uses Firebase, where passwords are
hashed by Google (scrypt) and data is in Firestore. To use Argon2id/PostgreSQL the backend would
have to be rebuilt as a separate server project.

## Deploy checklist: after publishing, check these
- Open the portal with DevTools Console open: there must be no red CSP errors.
  If one appears, the `Content-Security-Policy` header in `firebase.json` needs that host added.
- While logged out, try reading appointments in the Firestore console simulator: must be denied.
