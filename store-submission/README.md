# Store submission prep

GrilledCoin is installable today as a PWA (see the "Get the App" page) without
any store. This doc covers what's needed to *also* submit to Google Play /
Apple App Store, and what's already done vs. what only you can finish.

## Already done (in this repo)
- `public/privacy.html` and `public/terms.html` — required by both stores.
  Linked from the sidebar footer and the sign-up form.
- App identity: name "GrilledCoin", package/bundle ID `com.grilledcoin.app`
  (same ID already used by `windows-app/` for consistency).
- `public/manifest.json` + real icons in `public/images/pwa/` — the source
  both store-wrapping tools below read from.

## Content rating — read this first
Both stores have strict, separate review for **simulated gambling**, even
with virtual-only currency and no real-money wagering:
- **Google Play**: declare "Simulated Gambling" in the content rating
  questionnaire. Some countries (e.g. Netherlands, Belgium) restrict or block
  simulated gambling apps entirely — expect to exclude those in distribution
  settings.
- **Apple App Store**: guideline 1.4.3 requires simulated gambling apps to be
  rated 17+ and to clearly disclose odds/virtual-currency-only status (the
  terms page already states this).
- Expect manual review delay and a real chance of rejection/appeal on first
  submission — this is normal for the category, not a sign something's wrong.

## Android — Trusted Web Activity (TWA)
A TWA wraps this exact PWA into an Android App Bundle (`.aab`) for Play
Store — no separate codebase to maintain.

1. On a machine with full internet access (this sandbox can't reach Google's
   Android SDK servers), run:
   ```
   npx @bubblewrap/cli init --manifest https://YOUR_DOMAIN/manifest.json
   npx @bubblewrap/cli build
   ```
2. This produces `app-release-bundle.aab`. Sign it (Bubblewrap can generate
   a keystore on first run — back it up, you need the same one for every
   future update).
3. Create a Google Play Console account ($25 one-time) and upload the AAB.
4. Fill in the content rating questionnaire as above, and set the Privacy
   Policy URL to `https://YOUR_DOMAIN/privacy.html`.

## iOS — PWABuilder + Xcode
There is no way to produce an installable iOS app without a Mac.

1. Go to https://www.pwabuilder.com, enter your domain, and download the
   "iOS package" — this generates an Xcode project wrapping the PWA.
2. Open it in Xcode on a Mac, set your Apple Developer Team, and build.
3. Create an Apple Developer account ($99/year) if you don't have one.
4. Submit through App Store Connect. Use the same Privacy Policy URL, and
   answer "Yes" to the simulated gambling question in the age rating survey.

## If you'd rather skip the stores
The PWA install flow already on the "Get the App" page (Android: native
install prompt; iOS: Add to Home Screen) covers both platforms today with
none of the above — no accounts, no review, no risk of rejection.
