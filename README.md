# Walottery

Walottery is split into two parts:

- `move/` &mdash; the on-chain Move modules (`walottery::lottery_state`,
  `lottery_creation`, `lottery_participation`, `lottery_seal`) plus unit tests.
- `src/` &mdash; a React + Vite frontend scaffold created with
  `npm create @mysten/dapp`. The UI is intentionally minimal: it wires up
  `@mysten/dapp-kit`, wallet connection, Radix UI primitives, and three empty
  sections where the actual lottery experience can be implemented.

The repo already works with the new folder structure: running `sui move test`
from `move/` validates every module and the seal/claim/participation suites.
The frontend can be iterated independently without touching the Move sources.

## Requirements

- Node.js 18+ with npm (comes with `npm create @mysten/dapp`)
- Sui CLI for compiling / testing / publishing Move contracts

## Move workflows

```bash
cd move
sui move test            # run all unit tests
sui client publish --gas-budget 100000000   # publish when ready
```

After publishing, record your package IDs and object IDs somewhere safe. The
frontend exposes `src/networkConfig.ts` where you can fill in
`lotteryPackageId` per network when it is time to call the contracts.

## Frontend workflows

```bash
npm install        # install dependencies (React, Vite, dapp-kit, Radix UI…)
npm run dev        # start the Vite dev server at http://localhost:5173
npm run build      # type-check + create a production build in dist/
```

`src/App.tsx` only renders wallet status and placeholder sections. Hook your
components into those sections (or replace them entirely) when you begin calling
the Move contracts. The provider stack in `src/main.tsx` already supplies
dapp-kit’s `SuiClientProvider`, `WalletProvider`, and TanStack Query so that all
future hooks/components share the same configuration.

## Repository layout

```
.
├── move/               # Move code and tests
├── src/                # React/Vite frontend scaffold (no business logic yet)
├── package.json        # npm scripts: dev, build, lint, preview
└── README.md
```

This setup keeps the Move contracts self-contained while giving the frontend a
ready-to-use TypeScript baseline that speaks Sui wallets from day one.

## Cloudflare Workers + Supabase backend

All Worker entrypoints now live under `workers/`:

```
workers/api/index.ts      # HTTP API exposed via Cloudflare Workers
workers/indexer/index.ts  # Scheduled Worker that ingests LotteryCreated events
workers/watcher/index.ts  # Scheduled Worker that submits draw transactions
workers/shared.ts         # Common helpers (Supabase + Sui clients, Move decoders)
```

Legacy Node scripts (`scripts/*.mjs`) were removed now that the Cloudflare Workers + Supabase
pipeline supersedes the Express/PG setup. Use `wrangler` to run or develop workers locally.

Each worker expects the following environment variables (add them to `wrangler.toml` or the
Cloudflare dashboard):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `WALOTTERY_PACKAGE_ID`
- `SUI_FULLNODE_URL` (optional, falls back to `testnet`)
- `LOTTERY_DRAW_PRIVATE_KEY` (only needed by `watcher/`)
- `SUI_CLOCK_ID`, `SUI_RANDOM_ID` (optional overrides)
- Optional tuning knobs such as `LOTTERY_INDEXER_BATCH_SIZE`, `LOTTERY_INDEXER_PAGES_PER_RUN`,
  `LOTTERY_DRAW_BATCH_SIZE`, and `LOTTERY_API_ALLOWED_ORIGINS`.

### Supabase schema

Run the following SQL inside the Supabase SQL editor to mirror the tables used by the original
Node.js scripts:

```sql
create table if not exists lottery_created_events (
  id bigserial primary key,
  lottery_id text not null unique,
  creator text not null,
  deadline_ms bigint not null,
  total_prize_units bigint not null default 0,
  tx_digest text not null,
  event_seq bigint not null,
  emitted_at timestamptz not null default timezone('utc', now()),
  raw_event jsonb
);

create table if not exists lottery_indexer_state (
  singleton boolean primary key default true,
  cursor jsonb
);
```

Grant the Supabase service role key to the Workers so they can upsert rows. Read-only anon keys are
still fine for the frontend if you expose Supabase directly somewhere else.

### Worker deployment with Wrangler

Three ready-made configs live at the repository root:

- `wrangler.api.toml` &mdash; HTTP API worker (`workers/api/index.ts`)
- `wrangler.indexer.toml` &mdash; scheduled event ingester (`workers/indexer/index.ts`)
- `wrangler.watcher.toml` &mdash; scheduled draw submitter (`workers/watcher/index.ts`)

Replace the placeholder values under each file’s `[vars]` block with your deployed package ID,
Supabase project URL, and preferred defaults. Keep sensitive values (Supabase service role key,
`LOTTERY_DRAW_PRIVATE_KEY`, etc.) out of the file by setting them via Wrangler secrets:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.api.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.indexer.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.watcher.toml
wrangler secret put LOTTERY_DRAW_PRIVATE_KEY --config wrangler.watcher.toml
```

Deploy each worker with:

```bash
wrangler deploy --config wrangler.api.toml
wrangler deploy --config wrangler.indexer.toml
wrangler deploy --config wrangler.watcher.toml
```

The indexer and watcher configs already include sample cron triggers; tweak them as needed for your
desired cadence or switch to dashboard-based schedules if preferred.

### Walrus static site

The frontend build in `dist/` is static and can be uploaded to Walrus:

```bash
npm run build
walrus site create walottery-ui   # run once
walrus site deploy walottery-ui dist/
```

Point `VITE_LOTTERY_API_URL` to the Cloudflare Worker hostname so that the frontend reaches the new
API.
