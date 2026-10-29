# TypeLab

A free English touch-typing trainer: endless practice that levels up while you type, a course (with a programmer track), speed and code tests, a leaderboard, and shareable certificates.

It is a **separate website** with its own GitHub repository and its own Cloudflare project. The portfolio only links to it. Plain HTML, CSS and JavaScript on the page, no build step and no runtime dependencies; a small Cloudflare Worker (in `worker/`) powers the email login, leaderboard and certificate verification.

## What it does

- **Login with an emailed code**: you enter a name and an email, TypeLab emails a 6-digit code, and typing that code logs you in. That proves the address is yours. There is no password. A "Continue as a guest" option keeps the app usable without a rank or certificate. **The login ends when the browser is closed**, unless "Keep me logged in on this device" was ticked at login (it is off to begin with, for shared computers). Closing the browser also removes the session cookie that marks a login as still in progress; the name and email stay in the login form, and the progress is kept.
- **Practice** (one page for everything you type outside the course):
  - **Adaptive** is an endless run. Text keeps arriving, you start with six letters, and every time all your letters reach the target speed a new one unlocks. The level-up appears as a short message over the text and a highlighted letter. Nothing stops, resets or asks for a click. The run ends when you press Finish or leave the page, and is saved as one session.
  - **Only real words.** The word list (about 4,000 words) holds words people really use: daily life, books and stories, newspapers and the news, and programming. Practice never makes up words: at every level it picks real words that use only your unlocked letters, and at the first levels, where few words fit six letters, a word may come round again rather than a nonsense one appearing.
  - **Words come in batches.** The first batch is 20 ordinary words. After that every batch is 15 words, added before the last space of the previous batch is typed, so typing never waits. Once 20 words are typed, each new batch is built from the letters you mistyped in the last two batches: about a third of its words start with such a letter and about a third have one in the middle. The level box names those letters and marks them with a red dot. With no mistakes the words are ordinary again.
  - **Timed, Words, Sentences and Code** are the speed tests, now inside the same page. Optional punctuation, capitals and numbers.
  - Extras for the adaptive stream: capitals, punctuation, numbers and programming symbols.
  - **One screen on a desktop**: the typing (live numbers, the words, the keyboard) is in the exact middle of the page, with a column of the same width on each side: the title, level and letters on the left; the streak and mode on the right. Nothing needs scrolling. Key and text size follow the window's width and height. Only on a very short window does a side column scroll by itself. Below 1000px wide the page stacks and scrolls normally.
- **Streak**: a day counts only after **5 minutes of real typing**. The time adds up the gaps between keys (a gap of more than 2 seconds counts as 2), so opening a page, leaving a tab open, or typing two or three words does nothing. More than 5 minutes is fine but does not count extra. The Practice page has a big timer with seconds: it runs while you type, stands still two seconds after your last key ("Paused: breaks are not counted"), carries on after 5:00 so you can see your whole day, and announces the moment the day is complete. The typing time of a long run is added to the day every few seconds, not only when the run ends. The calendar in Progress marks streak days.
- **Visit clock**: a small timer at the bottom right of every page starts when you arrive and shows how long you have been on TypeLab (this visit, today, in total) next to your real typing time. It counts only while the tab is showing and you have used the page in the last three minutes.
- **Owner view**: `#/admin` lists every player with time on the site, real typing time, streak, 5-minute days, speed, accuracy, sessions and lessons, with the last 14 days per player, sorting, search and a CSV download. It opens only with the owner's key (see Deploy).
- **Strict typing**: a wrong key never moves on. The letter pulses red until the right key is typed.
- **Hands on the keyboard**: the two hands lie on the home row of the keyboard (index fingers on F and J), see-through at all times so the keys show through: faint while you type, a little stronger a moment after the last key. The finger that has to press the next key is coloured.
- **Sounds**: a tick for a right key, a buzz for a wrong key, a harder double buzz when the same key is missed twice, a chime at the end, and a very soft rise for a level-up in the middle of a run.
- **Course**, laid out like TypingMaster's: a **list of courses** (each with its description, how long it takes, how many lessons and exercises, how much is studied, and a Start Now / Continue Course button), then **one lesson at a time** with its numbered **exercises** (a tick for done, an arrow for the one to do next, Begin on each, lesson buttons at the bottom), then **one exercise** on a one-screen layout. A lesson is 4 to 7 exercises: key drills (the new keys alone, then mixed with the keys you know), word drills, a text drill (the keyboard is hidden and many lines show, as in TypingMaster) and the lesson exam. Finishing an exercise ticks it and shows Duration, Gross speed, Accuracy and Net speed with a word of evaluation; passing the exam (90% accuracy at the lesson's speed) passes the lesson and opens the next one. Two courses: **Touch Typing** (lessons 1 to 18: the home row to full sentences) and the **Programmer Track** (19 to 24: `@ # $ % ^ & *`, brackets, operators, `\ | ~ \``, camelCase / snake_case names, real code lines). Every printable key is taught by some lesson (a test checks this). Lessons keep their numbers 1 to 24, so progress saved earlier and the certificates are unchanged; a lesson passed before exercises existed counts as all its exercises done.
- **Progress**: your rank card (speed tier and your place by speed and by practice time), the **leaderboard** (everybody, with speed and practice time side by side, ordered by whichever you choose, all time or this week), 18 achievements, certificates, speed and accuracy charts, forecast, practice calendar, keyboard heatmap, speed by letter and finger, common mistakes, slow letter pairs.
- **Certificates**: pass lessons 1 to 18 for "Touch Typing", all 24 for "Touch Typing for Programmers". Each is a designed certificate with your name, speed, accuracy and an ID, with a public link that anyone can open and check, a PNG download, print / PDF, and share buttons (WhatsApp, LinkedIn post, "Add to LinkedIn profile", X, Facebook, email, and the phone's own share sheet).
- **Guided tours**: each section (menu, Home, Practice, the list of courses, a lesson, an exercise, Progress, Settings) has its own short tour, shown once per player. Finishing or skipping it saves it, and it never comes back unless the player picks "Show the tours again" in Settings.
- **Look**: **one Themes button** at the top right of every page (no separate light/dark switch: Light and Dark are two of the themes). Eight themes (Light, Dark, Gray, Yellow, Garden, Coffee, Chocolate, Honey) and a Custom one made from three colours you pick, plus optional background pictures that fit the theme (night pictures for dark themes, day pictures for light ones). None is pure white or pure black, and every theme (even Custom) keeps text easy to read: a test checks the contrast of each. With no choice made it follows the device (Light or Dark). A hands guide with five skin tones and a virtual keyboard with finger colours.
- **Desktop layout**: the logo is at the top left, the menu (Practice, Course, Progress, Learn, Settings) in the middle, and Themes and the profile at the top right. Pages use the whole window: Home puts the welcome beside the streak, Progress puts the rank beside the leaderboard and the achievements beside the certificates, Settings and Learn use two columns, and the Course and Practice pages are laid out in three (lessons or level on the left, the typing in the exact middle, the streak and tips on the right) with no scrolling where you type.
- Responsive from 320px, keyboard accessible, reduced-motion friendly.

## Run it locally

```
npm run serve        # http://127.0.0.1:5173/
```

The dev server sends the same headers as production (it reads them from `_headers`, so an inline script or style fails here first) and runs the real API (`server/core.mjs`) with a JSON file instead of Cloudflare KV. The data lives in `.devdata/` (ignored by git); the hashing and signing keys are created there on first run.

**Login codes while developing**: no email is sent. The dev server writes the message to `.devdata/outbox.json`, prints it in the terminal, and serves the latest one for an address at `http://127.0.0.1:5173/dev/outbox?to=you@example.com`. That route exists only in the dev server and only when `MAIL_PROVIDER`, `MAIL_API_KEY` and `MAIL_FROM` are not set; set them in the environment to send real email from the dev server.

`index.html` also opens straight from disk, but then there is no API: no rank and no verified certificates (certificates are marked "not verified"). Everything else works.

```
npm test             # Node's built-in test runner, no packages needed
```

## Deploy it as its own site

1. **GitHub**: put the contents of this folder in a new repository (the files in this folder are the repository root).
2. **Cloudflare**: Workers & Pages, Create, import the GitHub repository. Cloudflare creates a **Workers** project with the build command **(empty)** and the deploy command `npx wrangler deploy` (the default). Everything else comes from `wrangler.jsonc` in the repository:
   - the website is the repository root, served as static files; `.assetsignore` keeps `server/`, `worker/`, `tests/`, `tools/`, `node_modules` and the config files out of it (a dry run uploads exactly 56 files);
   - only `/api/*` runs the Worker (`worker/index.js`, which wraps `server/core.mjs`); every other address is a plain file;
   - `_headers` gives the site its security headers (Workers support it natively);
   - the `TYPELAB` KV namespace is declared there. Without an `id`, the first deploy creates the namespace itself (it did: `typelab-typelab`) and the id then has to be copied into `wrangler.jsonc` (it is, so later deploys keep using that namespace and never start an empty one). For a fresh Cloudflare account, delete the `id` and deploy once, then paste the id from the build log.
   - The Worker's name in `wrangler.jsonc` (`typelab`) must match the name in the dashboard.
3. **Turn on the leaderboard**: without this the site works but has no rank.
   1. After the first deploy, open the Worker, Settings, Variables and Secrets, and add two **secrets**: `TYPELAB_SALT` and `TYPELAB_SIGN_KEY`. Make each a long random value, for example:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   2. Check `https://<your-site>/api/health`: it answers `{"ok":true,...}`. Until both secrets exist, the other API routes answer "not-configured".
   - Keep the two secrets safe. Changing `TYPELAB_SALT` gives every player a new id (everyone starts unranked). Changing `TYPELAB_SIGN_KEY` makes old certificate links show "not verified".
   - Optional: add a Cloudflare rate-limiting rule for `/api/*`.
4. **Turn on the owner view** (optional): add one more secret, `TYPELAB_ADMIN_KEY`, a long random value made like the other two. Then open `https://<your-site>/#/admin`, paste that value, and you see how every player uses the site. Without the secret the page says it is switched off. A wrong key is refused, and ten wrong keys from one connection lock it for an hour. The key stays in that browser tab only.
5. **Turn on the login emails**: the login code is sent by an email service you choose. Without one, `otp/send` answers "mail-not-configured" and nobody can log in (guests still can use the app). Add three variables in the same Variables and Secrets page (`keep_vars` in `wrangler.jsonc` stops a later deploy from wiping them):
   - `MAIL_PROVIDER`: `brevo` (default choice) or `resend`.
   - `MAIL_API_KEY`: the provider's API key. Make it a **secret**.
   - `MAIL_FROM`: the sender, for example `TypeLab <login@your-domain.com>`.
   - **Brevo**: create an account, add and verify your sender address (Senders, Domains & Dedicated IPs), create an API key (SMTP & API), and use the verified address in `MAIL_FROM`. Brevo's rules about which sender addresses it accepts (for example free-mail addresses) change, so check their current documentation; a domain you own gives the most reliable delivery.
   - **Resend**: needs a domain you own and have verified with them; `MAIL_FROM` must be on that domain.
   - Check each provider's current free allowance before launch. Also set up SPF and DKIM for your sender if the provider asks, otherwise codes may land in spam.
   - Cloudflare's own email sending is not used. Redeploy after changing variables, then check `https://<your-site>/api/health`: it shows `"mail":true` when a provider is configured.
6. **Set the address** (optional): in `js/config.js` put the final address in `siteUrl` (for example `https://typelab.<your-account>.workers.dev/`). Left empty, certificate links use whatever address the page was opened from.
7. **Link it from the portfolio**: add a card or link in the portfolio's Projects section that points to the TypeLab address. Nothing else in the portfolio changes. The "Portfolio" link inside TypeLab comes from `portfolioUrl` in `js/config.js`.

## How the login and leaderboard work

- **Logging in**: the browser sends the email to `otp/send`. The server makes a 6-digit code, keeps only a **salted hash of the code** (with the email's salted hash as the key), and emails the code. The player types it, and `otp/verify` answers with a signed login token. The email itself is not stored and is never sent back.
  - A code works **once**, expires after **10 minutes**, and allows **5 wrong tries**. A new code can be asked for after 30 seconds, at most 5 an hour per email and 20 an hour per IP address.
  - The token is signed with `TYPELAB_SIGN_KEY` and lasts 90 days (renewed on use when under 30 days remain). Sync, delete and certificate requests need it; the leaderboard can be read without it.
  - The player id is a **salted SHA-256 hash of the lower-cased email**, so the same email gives the same id on every device and your rank follows you.
  - If the token is rejected (expired or the signing key changed), the app shows a banner asking the player to log in again; nothing is lost locally.
- The browser sends only summary numbers: ranking score, best speed, average accuracy, number of sessions and lessons passed, this week's best, and usage numbers: total time on the site, total real typing time, streak, days with 5 minutes of typing, and minutes per day for the last 14 days. Sessions stay in the browser. Names are shown as "Mukeem K." (first name and the first letter of the last name).
- Players can hide themselves, or delete their entry, in Settings.
- **One leaderboard, everybody on it.** Every player who has logged in is listed, whatever their speed or practice time: a speed of 2 WPM or no practice yet still has a place. Each row shows speed (the best speed in any run), practice time (minutes really typed, breaks left out), tier, accuracy, streak and runs. A filter orders the table by speed or by practice time, all time or this week; the other number breaks a tie. A player's numbers reach the board when they finish a run, log in, or about every three minutes while on the site.
- **The speed tier** (Beginner to Legend) follows the player's best speed. The older "ranking score" (the average of the best three qualifying runs of 20 seconds or more at 92% accuracy) is still worked out and is what the certificates and achievements use; the leaderboard no longer hides anyone for lacking it. **Speeds and times are reported by the browser**, so the leaderboard is for fun.
- **Scores are reported by the browser**, so they are for fun. The server rejects impossible values (over 250 WPM, accuracy outside 0 to 100, updates faster than every 1.5 seconds) but cannot stop a determined cheat.

### The API (`/api/...`)

| Route | What it does |
|---|---|
| `POST otp/send` | email: emails a 6-digit login code |
| `POST otp/verify` | email + code: returns a login token and the player's current rank, if any |
| `POST sync` | (token) the player's summary numbers; returns rank (all time and this week) and a fresh token when the old one is getting old |
| `GET board?scope=all\|week&by=speed\|time` | top ten, the rows around the player (when a token is sent), and the player's rank, on the speed board (default) or the practice-time board (minutes really typed) |
| `POST delete` | (token) removes the player's entry, with its usage numbers |
| `GET admin/players` | (owner key, not a player token) every player with usage numbers; the email is never in it |
| `POST certificate` | (token) signs a certificate if the player's synced lessons allow it |
| `GET verify?c=` | says whether a certificate code is genuine |
| `GET health` | `{ok, week, mail}`; works even before the KV binding exists |

Requests that need a token send it as `Authorization: Bearer <token>`.

The logic is in `server/core.mjs` and runs unchanged in the dev server and in `worker/index.js`. If the API is missing or not configured, the browser treats it as offline and carries on.

## Structure

```
index.html              app shell (no inline scripts or styles)
_headers                Cloudflare: security headers for the static files
wrangler.jsonc         Cloudflare Workers config: static assets, the /api/* Worker, the KV namespace
.assetsignore           what is in the repository but is not part of the website
robots.txt
css/                    style.css (tokens, layout), keyboard.css, scenes.css, social.css, practice.css (the one-screen Practice layout), presence.css (visit clock), admin.css
js/config.js            site address, portfolio link, API path, guest switch
js/theme.js             applies the saved theme and scene before first paint
js/core/                pure logic, also loaded by the Node tests (presence.js counts time on the site; themedata.js holds the theme colours)
  metrics, layout, engine, keystats, textgen, lessons, storage
  rank.js               ranking score, tiers, achievements, leaderboard numbers
  certificate.js        certificate codes, the certificate picture, share links
  api.js, account.js    API client; login profile, guest mode, sync
js/data/                word list (real words only), sentences, code snippets (written for this project)
js/ui/                  DOM helpers, themes, sounds, hands, keyboard, charts, typing screen, results, tour, visit clock
js/pages/               home, practice, course, stats (+ social.js), settings, learn, login, certificate, admin (owner view)
js/app.js               hash router, login gate, header pop-ups, tours
server/core.mjs         the API logic (login codes, tokens, leaderboard, certificates)
server/mail.mjs         sends the login email through Brevo or Resend
worker/index.js         the Cloudflare Worker around them (answers /api/* only)
assets/scenes/          the 12 background scenes (generated)
tests/                  unit tests
tools/serve.js          local server with the real API; tools/make-scenes.js draws the scenes
```

Scripts are plain `<script>` files (not ES modules) so the page also works from disk; the core files export themselves with `module.exports` for the tests.

## Privacy

- Saved in the browser: your sessions, letter statistics, settings, theme, tours seen, certificates, and (if you log in) your name, email and login token. Nothing is sent anywhere except the login email address (to send the code) and the summary numbers above.
- Saved on the server (Cloudflare KV): player id (hash), shortened display name, ranking numbers, lessons passed, usage numbers (time on the site, real typing time, streak, minutes per day for 14 days), when the player first and last appeared, and for a short time the hash of a pending login code. The owner can read all of this in the owner view. The login page and Settings tell players so, and "Delete my leaderboard entry" removes it. The email address is not stored. No sessions are stored. IP addresses are used only to count code requests, and only as a hash with a one-hour expiry.
- The email address does pass through the mail provider you pick, as any email does.

## Notes and limits

- Data is per browser. Logging in on another device brings your rank but not your sessions; use Settings, Download backup, then Restore backup to move those.
- The leaderboard is one record in KV that every update reads and rewrites, so two updates at the very same moment can lose one. It is fine for a small site; it is capped at 10,000 players (the lowest scores drop first).
- Names are not checked for rude words.
- The keyboard layout is US QWERTY (ANSI). Code snippets are single lines (no Enter, Tab or indentation yet).
- Mobile phones are not a target: touch typing needs a physical keyboard.
- The word list, sentences and code snippets are original to this project. The adaptive idea (frequency-ordered unlocking by per-key speed) is inspired by keybr.com, but no keybr code or data is used.
