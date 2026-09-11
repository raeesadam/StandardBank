# Running the platform in VS Code

Everything here works without admin rights and without installing any packages.
The only requirement is **Node 18 or later**.

---

## Step 1 — Check what Node you have

Open VS Code. Then open a terminal inside it:

**Terminal → New Terminal** (or `` Ctrl + ` `` on Windows/Linux, `` Cmd + ` `` on macOS)

Type:

```bash
node --version
```

| What you see | What to do |
|---|---|
| `v18.x` or higher | You are ready — go to Step 2. |
| Lower than `v18`, or `command not found` | Read "Getting Node without admin rights" at the bottom of this page first. |

---

## Step 2 — Open the project in VS Code

**Option A — clone from inside VS Code (easiest)**

1. Press `Ctrl + Shift + P` (macOS: `Cmd + Shift + P`) to open the Command Palette
2. Type `Git: Clone` and press Enter
3. Paste: `https://github.com/raeesadam/StandardBank.git`
4. Choose a folder inside your own user area, e.g. `C:\Users\<you>\Projects`
5. When VS Code asks "Would you like to open the cloned repository?", click **Open**

Then switch to the right branch: click the branch name in the blue bar at the
bottom-left of VS Code, and pick `claude/zealous-heisenberg-f87q8d`.

**Option B — from the terminal**

```bash
git clone https://github.com/raeesadam/StandardBank.git
cd StandardBank
git checkout claude/zealous-heisenberg-f87q8d
code .
```

---

## Step 3 — Confirm your machine can run it

In the VS Code terminal:

```bash
npm run check
```

You should see:

```
  OK    Node 22.22.2                                 meets the minimum of 18.0.0
  OK    The data folder is writable                  .../StandardBank/data
  OK    Port 4173 is free                            the platform will be at http://localhost:4173
  OK    The register is empty                        run "npm run seed" to load the demo data

Everything checks out. Next:  npm run seed  then  npm start
```

If anything says **FAIL**, the line next to it tells you exactly what to do.

---

## Step 4 — Load the demo data

```bash
npm run seed
```

```
Seeded: 12 themes, 216 observations, 30 root_causes, 38 actions, 9 incidents, 20 notes, 137 activity.
Saved to .../StandardBank/data/complaints.json
```

---

## Step 5 — Start it

Two ways — use whichever you prefer.

**With the Run button (recommended):** press **F5**.

VS Code starts the platform with the debugger attached and opens your browser
automatically. You can set breakpoints in any file under `server/` by clicking
in the left margin next to a line number.

**From the terminal:**

```bash
npm start
```

```
Recurrent Complaints Management platform running at http://localhost:4173
```

Then `Ctrl`-click (macOS: `Cmd`-click) that link in the terminal, or open
<http://localhost:4173> in your browser yourself.

---

## Step 6 — Test it

Click through these in the browser. If all eleven work, the platform is healthy.

1. **Hover the line chart** on the dashboard — a vertical line follows your pointer and a box shows Received/Resolved for that month
2. **Click "Show table"** below that chart — the raw numbers appear
3. **Click the longest bar** in "Most recurrent complaints" — it opens that complaint
4. **Click ← Register**, then search `debit order` — the list narrows to one row
5. **Clear the search and click any row** — the detail page opens with seven tabs
6. **Monitoring history → + Add a period**: date `2026-10-01`, complaints received `150`, click **Add** — the chart and the tiles both update
7. **+ Add a period again with the same date** — a red error appears under the date field
8. **Delete** the row you added, and confirm
9. **Full history tab** — your add *and* your delete are both listed, with a name and timestamp
10. **Change "Working as"** in the header to your name — anything you enter afterwards is recorded against it
11. **Click Dark**, then narrow the window to phone width — the layout stacks into one column

### Run the automated tests

Press `Ctrl + Shift + P` → `Tasks: Run Test Task`, or in the terminal:

```bash
npm test
```

```
# tests 36
# pass 36
# fail 0
```

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm run check` | Confirms your machine can run it and explains anything that can't |
| `npm run seed` | Loads the demo register (only if it is empty) |
| `npm start` | Starts the platform |
| `npm test` | Runs the 36 automated tests |
| `npm run reset` | Wipes and reloads the demo data |
| `npm run dev` | Restarts automatically when you edit a file (needs Node 18.11+) |

**To stop the platform:** click into the terminal running it and press `Ctrl + C`.

VS Code's Command Palette (`Ctrl + Shift + P` → `Tasks: Run Task`) has all of
these as clickable entries if you would rather not type.

---

## Where your data lives

Everything is in one file: **`data/complaints.json`**.

It is plain, readable JSON — you can open it in VS Code to see exactly what is
stored. It is excluded from git, so your entries are never pushed anywhere. To
start over, delete the file (or run `npm run reset`).

To keep it somewhere else — a network drive, or your home folder if the project
folder is read-only:

```bash
# macOS / Linux
RCM_DB_PATH=~/rcm-register.json npm start

# Windows PowerShell
$env:RCM_DB_PATH="$HOME\rcm-register.json"; npm start
```

---

## If something goes wrong

| What you see | What it means and what to do |
|---|---|
| `npm: command not found` | Node isn't installed, or VS Code was open before you installed it — close VS Code fully and reopen it |
| `Port 4173 is already in use` | It's already running in another terminal. Either use that one, or run `PORT=8080 npm start` and open <http://localhost:8080> |
| `SyntaxError: Unexpected token` on startup | Your Node is older than 18 — run `node --version` to confirm |
| Browser says "can't connect" | The server isn't running. Check the terminal for the "running at" line |
| A blank white page | You opened `index.html` as a file. Use the `http://localhost:4173` address instead |
| `Could not read the register` | `data/complaints.json` was edited into an invalid state — delete it and run `npm run seed` |

---

## Getting Node without admin rights

If `node --version` shows nothing or a version below 18, and you can't run an
installer, any one of these gets you there:

**Windows**

- **fnm** or **nvm-windows** — version managers that install into your user
  profile, no admin needed
- **The Node.js ZIP build** — download the `.zip` (not the `.msi`) from
  <https://nodejs.org/en/download>, unzip it into e.g. `C:\Users\<you>\node`,
  then in PowerShell:
  `$env:Path = "C:\Users\<you>\node;$env:Path"` before running commands.
  To make it permanent, add that folder to your user `Path` under
  *Edit environment variables for your account* — which does not need admin.

**macOS**

- **nvm**: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`
  then `nvm install 20`
- Or the `.pkg` installer, choosing "Install for me only"

**If your bank blocks all of the above**, ask IT for "Node.js LTS" on a
software request — it is a standard developer runtime with no service or driver
component. In the meantime, the hosted demo link gives you the full interface in
a browser with nothing installed at all.
