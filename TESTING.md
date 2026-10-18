# Test on your laptop, other laptops and phones (no hosting)

## What you need (once)
Install **Node.js LTS** from https://nodejs.org (no other packages needed).

## Start
- **Windows:** double-click `start-server.bat`
- **Mac/Linux:** run `./start-server.sh` (or `node server.js`)

The window prints addresses like:
```
On this laptop:                       http://localhost:3000
Phones / laptops on the same Wi-Fi:   http://192.168.1.25:3000
```
- Open the **second address** on any phone or laptop connected to the **same Wi-Fi**.
- Owner page: add `/owner.html` to the address.
- Windows may ask to allow Node.js through the firewall: choose **Private networks**.
- If a phone cannot connect: guest Wi-Fi and some public/office networks block device-to-device traffic. Use your home Wi-Fi or a phone hotspot.

Everything is shared: a property added on the laptop shows on the phones straight away,
and appointments booked on a phone appear in the owner dashboard. Data is kept in the `data/` folder.

## Owner login with two-factor authentication
1. Go to `/owner.html`, sign in with `owner@gharkul.demo` / `owner123`.
2. **First time only:** the page shows a setup key. In **Google Authenticator** or **Microsoft Authenticator**
   choose *Add account → Enter a setup key*, type the key (type: time-based), then enter the 6-digit code.
3. Save the **8 recovery codes** shown (they appear only once, each works once).
4. From now on every login needs password + the 6-digit code from the app.

Use your own password: in the terminal before starting,
`set OWNER_PASSWORD=YourLongPassword` (Windows) or `OWNER_PASSWORD=YourLongPassword node server.js` (Mac/Linux).
Lost phone and recovery codes? Stop the server and delete `data/2fa.json`; you will enrol again.

## Testing from outside your Wi-Fi (optional)
Use a tunnel such as Cloudflare Quick Tunnel (`cloudflared tunnel --url http://localhost:3000`) or ngrok.
It gives a temporary https address. While it runs, **anyone with the link can reach the site and the login page**,
so set a strong `OWNER_PASSWORD`, keep 2FA on, and stop the tunnel when finished.

## Without Node (limited)
`python -m http.server 8000` in this folder works for looking at the pages, but data is then stored
per browser (not shared), and the owner login runs in demo mode without 2FA.

## Test checklist
Buy/Rent filters · open a property · save ♥ · book an appointment on the phone · log in as owner on the laptop ·
confirm the appointment appears · add a property with photos · refresh the phone and see it · delete it · log out.
