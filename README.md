# Workout App — How to Put It Online (Beginner Guide)

You do **not** need to install anything on your computer. Everything below happens
in a web browser, and every website used has a **free plan**.

There are two ways to do this. Pick ONE.

---

## ⚡ OPTION A — See it live in 2 minutes (no account needed)

Use this if you just want to look at it on a real web address right now.
(The web address is temporary-ish and you update it by dragging the folder again.)

1. Find the file **`workout-app-built.zip`** that came with this project.
2. Double-click it to unzip. You'll get a folder with an `index.html` inside it.
3. In your browser, go to **https://app.netlify.com/drop**
4. Drag that unzipped folder onto the page.
5. Wait ~20 seconds. Netlify gives you a live web link. Done — open it on your phone.

That's it. To keep/manage the site, make a free Netlify account when it prompts you.

---

## 🌟 OPTION B — A permanent web address you can update (recommended)

This gives you a real, always-on link (free forever for personal use) that you can
re-publish any time you make a change. It uses two free websites: **GitHub** (stores
your code) and **Vercel** (turns it into a live website automatically).

You will use the file **`workout-app-source.zip`** for this. Unzip it first — you'll
get a folder called `workout-app`.

### Step 1 — Make a free GitHub account
1. Go to **https://github.com** and click **Sign up**.
2. Follow the prompts (email, password, username). It's free.

### Step 2 — Create a place to store the code (a "repository")
1. Once logged in, click the **+** in the top-right corner → **New repository**.
2. **Repository name:** type `workout-app`
3. Leave everything else as-is. Make sure it's set to **Public** (or Private — either works).
4. Click **Create repository**.

### Step 3 — Upload the app files
1. On the new repository page, look for the link **"uploading an existing file"**
   (it's in the middle of the page). Click it.
   - If you don't see it: click **Add file** → **Upload files**.
2. Open the unzipped `workout-app` folder on your computer.
3. Select **everything inside it** (the `src` folder, `public` folder, `index.html`,
   `package.json`, `vite.config.js`, `README.md`, `.gitignore`) and **drag it all**
   onto the GitHub upload page.
   - ⚠️ Do NOT upload the `node_modules` or `dist` folders if you happen to have them.
     (They're not in the zip, so you should be fine.)
4. Scroll down and click the green **Commit changes** button.

### Step 4 — Create a free Vercel account
1. Go to **https://vercel.com** and click **Sign Up**.
2. Choose **Continue with GitHub** and allow it to connect. This links the two accounts.

### Step 5 — Publish the website
1. In Vercel, click **Add New…** → **Project**.
2. You'll see your `workout-app` repository in the list. Click **Import** next to it.
3. Vercel automatically detects it's a Vite app — you don't need to change any settings.
4. Click **Deploy**.
5. Wait about a minute while it builds. When it's done you'll see a **Congratulations**
   screen with a link like `https://workout-app-xxxx.vercel.app`.
6. Open that link on your phone. 🎉

### Step 6 — Add it to your phone's home screen (feels like a real app)
- **iPhone (Safari):** open the link → tap the **Share** icon → **Add to Home Screen**.
- **Android (Chrome):** open the link → tap the **⋮** menu → **Add to Home screen** /
  **Install app**.

---

## How to make changes later (Option B)

Every time you change a file in GitHub, Vercel **automatically re-publishes** the site
within a minute. To edit:

1. Go to your repository on GitHub.
2. Click into the file you want to change (for example `src/App.jsx`).
3. Click the **pencil ✏️ icon** to edit it in the browser.
4. Make your change, scroll down, click **Commit changes**.
5. Vercel rebuilds and your live link updates on its own.

(Or paste a whole new version of `App.jsx` — replace the contents, commit, done.)

---

## Good to know

- **Cost:** Vercel's free "Hobby" plan and Netlify's free plan are enough for personal
  use. Vercel's free plan is for personal (non-commercial) projects — if you ever sell
  the app, you'd move to a paid plan.
- **Your data doesn't save yet.** Right now the app resets when you refresh (it's a
  look-and-feel version with example data). Making your weigh-ins, workouts, and program
  edits save permanently is the next step — it needs a small amount of storage code added.
  Ask and I'll wire that in.
- **This is the same code** you approved in our chat — nothing about the look or behaviour
  has changed. It's just been wrapped into a standard project so websites can build it.

## For the curious (totally optional)

If you ever install Node.js on your computer, you can run the app locally with:

```
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).
To make the built version: `npm run build` (output goes to the `dist` folder).
