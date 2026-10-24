# yah. temporary site

A one-page holding site for **Yale Agentic Hackathons (yah.)** with a sign-up form
for the Spring 2027 hackathon and future events. It is plain HTML/CSS/JS, has no
build step and is hosted on GitHub Pages. Sign-ups go to a Supabase table.

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `styles.css` | Styling, using the logo's Yale blue `#00356B` with Libre Caslon Text and Inter |
| `app.js` | Sign-up form logic: checks the fields, then posts to Supabase |
| `config.js` | Supabase URL and publishable key |
| `supabase/yah_signups.sql` | Creates the new `yah_signups` table and its security rules |
| `favicon.svg` | Browser tab icon |

---

## 1. Set up Supabase (once)

1. Open your Supabase project (the site is set up for project `vsfjoqvjixvuutqczxdr`).
   If it says **Paused**, click **Restore project** and wait a couple of minutes.
2. Go to **SQL Editor → New query**, paste everything in `supabase/yah_signups.sql`, and click **Run**.
   This creates a **new** table called `yah_signups`. No existing table is changed.
3. Go to **Project Settings → API Keys** and copy the **publishable** key
   (starts with `sb_publishable_`; the legacy `anon` key also works).
   **Do not** use the `service_role` / secret key.
4. In `config.js`, replace `PASTE_YOUR_PUBLISHABLE_KEY_HERE` with that key and commit.
   If you use a different project, update `SUPABASE_URL` too.

The publishable key is safe to have in a public site. The table's row-level security
lets the public **add** sign-ups but never read, edit or delete them.

**To see sign-ups:** Supabase → **Table Editor → yah_signups**. You can export to CSV from there.

> Free Supabase projects pause after about a week with no activity. Sign-ups count as
> activity, but if the site goes quiet, check the project hasn't paused.

## 2. Publish with GitHub Pages

1. On GitHub, open the repo → **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **`main`** and folder **`/ (root)`**, then click **Save**.
4. After a minute or two the site is live at
   `https://25mkapadiya.github.io/yah.-Site/`. The link also appears at the top of the Pages settings.

Every push to `main` updates the site automatically.

## 3. Connect your GoDaddy domain

Replace `yourdomain.com` below with your real domain.

### Step A: Tell GitHub the domain

1. Repo → **Settings → Pages → Custom domain**.
2. Type `www.yourdomain.com` and click **Save**.
   GitHub adds a `CNAME` file to the repo for you. Pull it before your next local edit (`git pull`).
   (Using `www` as the main address with the bare domain redirecting to it is GitHub's recommended setup.
   GitHub redirects `yourdomain.com` ↔ `www.yourdomain.com` automatically once both DNS records below exist.)

### Step B: Add DNS records in GoDaddy

1. Sign in at godaddy.com → **My Products** → next to your domain click **DNS** (or **Manage DNS**).
2. **Delete** any existing records that would conflict:
   - Any **A** record with name `@` (often GoDaddy's "Parked" record).
   - Any **CNAME** record with name `www`.
   - If **Forwarding** is turned on for the domain, turn it off.
3. Add these **four A records** (one at a time: **Add New Record**):

   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | A | `@` | `185.199.108.153` | 1 Hour (or default) |
   | A | `@` | `185.199.109.153` | 1 Hour |
   | A | `@` | `185.199.110.153` | 1 Hour |
   | A | `@` | `185.199.111.153` | 1 Hour |

4. *(Optional, for IPv6)* add four **AAAA** records with name `@`:
   `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
5. Add **one CNAME record**:

   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | CNAME | `www` | `25mkapadiya.github.io` | 1 Hour |

   The value is just your GitHub Pages host, with **no** repo name and no `https://`.

### Step C: Verify and turn on HTTPS

1. DNS changes usually take effect in 10–60 minutes (occasionally up to 48 hours).
   You can check at <https://dnschecker.org> by searching your domain (A record) and `www.yourdomain.com` (CNAME).
2. Back in **Settings → Pages**, the custom domain check should say **DNS check successful**.
3. Tick **Enforce HTTPS**. If it's greyed out, wait: GitHub needs up to ~1 hour after DNS
   resolves to issue the free SSL certificate.

### Recommended: verify the domain on GitHub

This stops anyone else from claiming your domain on GitHub Pages if the repo is ever renamed or deleted.

1. GitHub → your profile picture → **Settings → Pages** (account settings, not the repo) → **Add a domain**.
2. Enter `yourdomain.com`. GitHub shows a **TXT** record (name like `_github-pages-challenge-25mkapadiya`).
3. Add that TXT record in GoDaddy DNS, wait a few minutes, then click **Verify**.

### Troubleshooting

- **"Domain's DNS record could not be retrieved"**: DNS hasn't propagated yet. Wait and click **Check again**.
- **Site shows a GoDaddy parked page**: the old parked A record or forwarding is still active. Remove it.
- **Custom domain disappeared from settings after a push**: the `CNAME` file was deleted. Re-add the domain in Settings → Pages.
- **Sign-up form says "Sign-ups open soon"**: the publishable key in `config.js` hasn't been filled in yet.

## Local preview

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit <http://localhost:8000>.
