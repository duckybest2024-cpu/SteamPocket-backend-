# Database Setup — Make Your Data Stop Disappearing

## What was happening

GrilledCoin stores everything — accounts, balances, subscriptions, and your
admin settings (AdSense IDs, SMTP, PayPal, house edge, etc.) — in a built-in
database that lives in the server's **memory**.

Memory is wiped every time the server restarts, and **Railway restarts your
server on every redeploy**. So every time new code went live, all of that data
reset back to empty. That's why your Google/AdSense fields kept going blank and
accounts seemed to vanish.

## The fix (two parts)

1. **Code change (already done):** the database now **saves itself to a file**
   on disk and reloads it when the server starts. ✅ Nothing for you to do here.
2. **Railway setup (you do this, ~3 minutes):** give that file a **permanent
   home** so it survives redeploys. A normal container's disk is also wiped on
   redeploy — only a **Volume** persists. This guide is that step.

---

## Step-by-step: add a persistent Volume on Railway

1. Open your project at **railway.app** and click your **backend service** (the
   one running GrilledCoin).
2. Go to the **Variables** tab and add a new variable:
   - **Name:** `DATA_FILE`
   - **Value:** `/data/db.json`
3. Go to the **Settings** tab → scroll to **Volumes** → click **+ New Volume**
   (or **Add Volume**).
   - **Mount path:** `/data`
   - Save it.
4. Railway will **redeploy** automatically. Wait for it to finish.

That's it. From now on, the database file lives at `/data/db.json` on the
Volume, which Railway keeps across every redeploy.

> ⚠️ **Important:** the redeploy that adds the Volume starts from an empty data
> file, so you'll re-enter your settings **one last time** after this. Do it
> right after the Volume is attached — from then on they'll stick.

---

## How to verify it worked

1. After the Volume is attached and the deploy is green, log in as the owner
   (`ditol21`), open **Admin → Config**, and re-enter your AdSense / SMTP /
   PayPal / house-edge settings. Save each section.
2. Make a tiny change and **redeploy** (or just wait for the next deploy).
3. Reopen **Admin → Config**. Your settings should still be there. 🎉

You can also confirm in the server logs — on startup you should see:

```
💾 Restored database from /data/db.json
```

If you see that line, persistence is working.

---

## FAQ

**Do I need a separate Postgres database?**
Not for this. The built-in database + a Volume is enough to stop data loss and
is the simplest setup. If GrilledCoin ever grows to thousands of players and you
want a "real" managed database (backups, dashboards, multiple servers), you can
later migrate to **Railway Postgres** — ask and it can be wired up, but it's a
bigger change and not needed right now.

**Where is my data physically?**
In the single file `/data/db.json` on the Railway Volume. Everything (users,
bets, config) is in there.

**How do I back it up?**
In Railway, open the service → the Volume → you can browse/download its
contents. Grab `db.json` periodically and keep a copy somewhere safe. (A
scheduled auto-backup can be added on request.)

**I changed `DATA_FILE` and now data looks empty.**
The data follows the file path. If you point `DATA_FILE` somewhere new, it
starts a fresh empty file. Set it back to `/data/db.json` to get your data back.

**Local development:**
With no `DATA_FILE` set, it defaults to `./data/db.json` next to the app, so
your local data persists between runs too. The `data/` folder is git-ignored.
