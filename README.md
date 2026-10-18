# Sanjeev's Gharkul Real Estate Consultancy – website

**To test on laptops and phones without hosting: read `TESTING.md`** (run `start-server.bat`).
You can also just open `index.html` / `owner.html` in a browser (demo mode, data stays in that browser).

```
index.html          public site (no link to the owner page)
owner.html          owner login + dashboard (properties + photos, announcements,
                    appointments, activity log)
css/ js/            styles and scripts (config.js holds settings)
images/founder.jpeg owner photo used in the About section
server.js           test server (shared data, owner login + 2FA)  <- run with start-server.bat
TESTING.md          how to test on other devices
firestore.rules     server-side rules          storage.rules  photo rules
firebase.json       hosting split + security headers
scripts/setOwnerClaim.js   gives a Firebase user the owner role
SECURITY-SETUP.md   security status + step-by-step live setup
```
Demo owner login (demo mode only): see `js/config.js`. Change it, and read SECURITY-SETUP.md before going live.
Logo, hero and partner images load from https://gharkul.co.in.
