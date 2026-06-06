# FamEx — Family Expense Dashboard

A mobile-first expense tracker for a two-person household (Oy & Build) with shared-cost
splitting and settlement. Built as a LINE LIFF app + web dashboard backed by Google Sheets.
UI is bilingual (Thai default / English).

## Stack

- **Frontend:** React 18 + Vite 5, `recharts` for charts. No TypeScript, no CSS framework
  (all styling is inline `style={}` objects), no test framework.
- **Backend:** Google Sheets — **reads** go directly to the Sheets API v4 (API key);
  **writes** go to a Google Apps Script (GAS) web app over HTTP GET.
- **AI:** `@anthropic-ai/sdk` (Claude), called only from Vercel serverless functions in
  `/api` (see "AI features" below). The API key is server-side only.
- **Platform:** LINE LIFF (the `/liff/*` pages run inside the LINE app via the LIFF SDK).
- **Deploy:** Vercel. `vercel.json` rewrites every path to `/index.html` (SPA). Files in
  `/api` are auto-deployed as serverless functions.

## Commands

```bash
npm install
npm run dev      # vite dev server
npm run build    # vite production build
npm run preview  # preview the build
```

There is no lint or test script.

## Environment variables

Set these in a `.env` file (Vite `VITE_` prefix) or in Vercel project settings. There is no
`.env.example` in the repo — these are the required keys:

| Var | Purpose |
|---|---|
| `VITE_SHEET_ID` | Google Spreadsheet ID (read source) |
| `VITE_API_KEY`  | Google API key with Sheets read access |
| `VITE_GAS_URL`  | Deployed Apps Script web-app URL (all writes) |
| `ANTHROPIC_API_KEY` | Claude key for the `/api` functions. **No `VITE_` prefix** — server-side only, must never reach the browser. Set in Vercel env vars (and in `.env` for `vercel dev`). |

LIFF IDs are **hardcoded** in `src/liff/utils.js` (`LIFF_IDS`), not env-driven.

## Routing

No router library. `src/main.jsx` switches on `window.location.pathname`:

| Path | Component | Purpose |
|---|---|---|
| `/` | `src/App.jsx` | Dashboard (charts, settlement, transaction list) |
| `/liff/add` | `src/liff/AddTransaction.jsx` | Add expense or direct debt |
| `/liff/payments` | `src/liff/ManagePayments.jsx` | Manage cards / payment methods |
| `/liff/categories` | `src/liff/ManageCategories.jsx` | Manage categories |
| `/liff/payers` | `src/liff/ManagePayers.jsx` | Manage members |

`src/components/BottomNav.jsx` is the persistent bottom nav (rendered globally in `main.jsx`).
Navigation is full-page `window.location.href` assignment, not client-side.

## Data model (Google Sheets)

**Reference sheets** (flat, row 1 = headers): `members`, `categories`, `payment_methods`.
Rows have an `active` (`"TRUE"`/`"FALSE"`) and `order` column; the UI filters to active and
sorts by `order`.

**Transaction storage — two shapes, read with a fallback:**

1. **Per-month sheets** named `MM-YYYY` (e.g. `05-2026`) — the primary path. Layout:
   - Row 1: settlement header
   - Row 2: settlement data `[month, from, to, amount, status, settled_at]`
   - Row 3: transaction headers
   - Row 4+: transaction rows
   See `fetchMonthSheet()` in `App.jsx`.
2. **Legacy flat `transactions` sheet** — fallback when the month sheet is empty/missing;
   the dashboard then filters rows client-side by month. See `load()` in `App.jsx`.

**Transaction fields:** `date`, `name`, `amount`, `category`, `type`, `payer`,
`payment_id`, `note`, `to`, `created_at`.
- `type` is `expense` | `direct` | `income`.
- `payment_id` is stored as a **display label string**, not an ID — format
  `"<name> ···<last4> (<owner>)"`, e.g. `"SCB ···1234 (Oy)"`. Owner is parsed back out of
  this label (see below).
- `to` is the creditor, used only for `direct` debt rows.
- `created_at` is the row key used for edit/delete (normalized via `normalizeCreatedAt()`
  because GAS may emit single-digit hours).

## Apps Script (GAS) API

All writes/queries hit `VITE_GAS_URL` as GET requests with `action` + params (see
`sendToGAS()` in `src/liff/utils.js`). Known actions referenced by the frontend:

- `addTransaction`, `editTransaction`, `deleteTransaction`
- `markSettled` (marks a month's settlement done)
- `checkDuplicate` (date + amount + payment_id match, before saving)
- `getCategories`, `getMembers`, `getPayments` (used by the LIFF add page; falls back to
  direct `fetchSheet()` if these endpoints are absent)

Responses are JSON with `status: 'ok' | 'found' | ...` and an optional `message`.

## Settlement logic (`computeSettlement` in App.jsx)

The core domain rule. For each transaction in a month:
- **`expense`** counts toward the month total. The paying member is the **card owner**
  resolved from `payment_id`. If the card is shared (`ร่วมกัน`) the amount is split evenly
  across members; otherwise it's fully attributed to the owner.
- **`direct`** debt is *not* added to the total; it shifts balances directly
  (`payer` paid less, `to` paid more).

Each member's balance = what they paid − their equal share of total expenses. A greedy
debtor→creditor match produces the minimal set of settlement transfers.

**`resolveOwnerFromLabel(paymentLabel, payer)`** — owner attribution rules:
- `cash`/`เงินสด` → the `payer`.
- contains `t1` → **hardcoded to `'Build'`** (a specific card special-case).
- otherwise parse the trailing `(Owner)` from the label; `ร่วมกัน` (= "shared") → split.

`MEMBER_COLORS` supports up to 4 members, but the dashboard's comparison bar and several
labels assume exactly two (Oy & Build).

## i18n (`src/i18n.js`)

- Two languages: `th` (default) and `en`. Current lang in `localStorage['lang']`.
- `setLang()` dispatches a `langchange` window event; components subscribe and re-render.
- `t(key, lang)` looks up the `T` dictionary. New user-facing strings must be added to `T`.
- `src/components/LangToggle.jsx` is the switcher.

## Caching (`src/cache.js`)

`localStorage` cache with `fex_` prefix and a 5-minute TTL. Keys: `dash_refs`
(dashboard reference data), `add_refs` (add-page reference data). `bustCache()` clears keys
— the dashboard refresh button busts `dash_refs` before reloading. The dashboard also
reloads on `visibilitychange` (tab refocus).

## AI features (`/api` Claude functions)

Claude is called only from Vercel serverless functions in `/api` — the key stays
server-side. The frontend POSTs JSON to `/api/<name>` and gets JSON back. Pattern:
constrain the model with **structured outputs** (`output_config.format`, enum-limited) so
responses are always valid; fail soft so the app works unchanged if the call errors.

**`/api/categorize.js`** — suggests an expense category.
- Input: `{ name, note, lang, categories: [{name, icon}] }`. Output: `{ category, confidence }`
  where `category` is enum-constrained to the passed-in names (or `"none"`).
- Model: `claude-haiku-4-5` (cheap/fast; no `effort`/`thinking` — Haiku rejects `effort`).
- Used by `src/liff/AddTransaction.jsx`: a 600ms debounce on the item-name field calls it,
  then pre-selects the chip (marked ✨ via `catSource === 'ai'`). A manual pick
  (`pickCategory`, sets `catSource = 'user'`) is never overridden. Results are cached in
  localStorage (`cat_<name>`, 1-day TTL) to avoid repeat calls.

**Local dev:** `npm run dev` (Vite) does **not** run `/api` functions. Use `vercel dev`
(`npm i -g vercel`) to exercise the AI path locally; it needs `ANTHROPIC_API_KEY` in `.env`.

## Conventions & gotchas

- **Inline styles only.** Shared style objects live at the bottom of each file (e.g. `S` in
  `App.jsx` / `AddTransaction.jsx`). `src/index.css` is minimal.
- **Comments are in Thai**; emoji are used as category/UI icons throughout.
- **LIFF/Android tap quirk:** `onClick` can be blocked inside LINE on Android, so
  interactive elements use a combined `onClick` + `onTouchEnd` handler (the `tap()` helper
  in `AddTransaction.jsx`). Preserve this pattern on touch targets in `/liff/*`.
- **Writes are HTTP GET** to GAS with URL-encoded params (Apps Script web-app constraint),
  not POST/JSON.
- **Dead code — do not edit, prefer deleting:** `src/BottomNav.jsx` and
  `src/ManageCategories.jsx` (top-level) are unused duplicates. The live versions are
  `src/components/BottomNav.jsx` and `src/liff/ManageCategories.jsx`.
