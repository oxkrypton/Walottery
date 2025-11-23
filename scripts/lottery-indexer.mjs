import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Pool } from 'pg';

const NETWORK = process.env.SUI_NETWORK ?? 'testnet';
const RPC_URL = process.env.SUI_FULLNODE_URL ?? getFullnodeUrl(NETWORK);
const PACKAGE_ID = process.env.WALOTTERY_PACKAGE_ID;
if (!PACKAGE_ID) {
  console.error('Missing WALOTTERY_PACKAGE_ID. Set it in your .env file.');
  process.exit(1);
}
const EVENT_TYPE = `${PACKAGE_ID}::lottery_creation::LotteryCreated`;
const POLL_INTERVAL_MS = Number(process.env.LOTTERY_INDEXER_POLL_INTERVAL_MS ?? 5000);
const BATCH_SIZE = Number(process.env.LOTTERY_INDEXER_BATCH_SIZE ?? 50);

const CREATE_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS lottery_created_events (
    id BIGSERIAL PRIMARY KEY,
    lottery_id TEXT NOT NULL UNIQUE,
    creator TEXT NOT NULL,
    deadline_ms BIGINT NOT NULL,
    total_prize_units BIGINT NOT NULL DEFAULT 0,
    tx_digest TEXT NOT NULL,
    event_seq BIGINT NOT NULL,
    emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_event JSONB
  );
`;

const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS lottery_indexer_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
    cursor JSONB
  );
`;

async function initializeDatabase(pool) {
  await pool.query(CREATE_EVENTS_TABLE);
  await pool.query(CREATE_STATE_TABLE);
  await pool.query(`
    ALTER TABLE lottery_created_events
    ADD COLUMN IF NOT EXISTS total_prize_units BIGINT NOT NULL DEFAULT 0;
  `);
}

async function getLastCursor(pool) {
  const result = await pool.query('SELECT cursor FROM lottery_indexer_state WHERE singleton = TRUE');
  const stored = result.rows[0]?.cursor;
  if (!stored) return null;
  return stored;
}

async function saveCursor(pool, cursor) {
  await pool.query(
    `
      INSERT INTO lottery_indexer_state (singleton, cursor)
      VALUES (TRUE, $1::jsonb)
      ON CONFLICT (singleton) DO UPDATE SET cursor = EXCLUDED.cursor;
    `,
    [JSON.stringify(cursor)],
  );
}

async function upsertLotteryEvent(pool, event) {
  const parsed = event.parsedJson || {};
  const lotteryId = parsed.lottery_id;
  if (!lotteryId) {
    console.warn('LotteryCreated missing lottery_id', event);
    return;
  }

  const deadlineMs = Number(parsed.deadline_ms ?? 0);
  const totalPrizeUnits = Number(parsed.total_prize_units ?? 0);
  const creator = parsed.creator ?? '0x0';

  const eventSeq = Number(event.id?.eventSeq ?? event.id?.seqNumber ?? event.eventSeq ?? 0);
  const digest = event.id?.txDigest ?? event.transactionDigest ?? event.txDigest ?? '';
  const timestampMs = Number(event.timestampMs ?? Date.now());
  const timestamp = new Date(timestampMs).toISOString();

  await pool.query(
    `
      INSERT INTO lottery_created_events (
        lottery_id,
        creator,
        deadline_ms,
        total_prize_units,
        tx_digest,
        event_seq,
        emitted_at,
        raw_event
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (lottery_id) DO UPDATE SET
        creator = EXCLUDED.creator,
        deadline_ms = EXCLUDED.deadline_ms,
        total_prize_units = EXCLUDED.total_prize_units,
        tx_digest = EXCLUDED.tx_digest,
        event_seq = EXCLUDED.event_seq,
        emitted_at = EXCLUDED.emitted_at,
        raw_event = EXCLUDED.raw_event;
    `,
    [
      lotteryId,
      creator,
      deadlineMs,
      totalPrizeUnits,
      digest,
      eventSeq,
      timestamp,
      JSON.stringify(parsed),
    ],
  );
}

async function pollEvents() {
  console.log(`Starting lottery indexer on ${NETWORK} (${RPC_URL}) for ${EVENT_TYPE}`);
  const client = new SuiClient({ url: RPC_URL });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // 🚨 开发环境下关闭严格证书校验
    },
  });
  await initializeDatabase(pool);

  let cursor = await getLastCursor(pool);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  while (true) {
    try {
      const response = await client.queryEvents({
        query: { MoveEventType: EVENT_TYPE },
        cursor: cursor ?? undefined,
        limit: BATCH_SIZE,
        order: 'ascending',
      });

      if (response.data.length === 0) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      for (const event of response.data) {
        await upsertLotteryEvent(pool, event);
        if (event.id) {
          cursor = event.id;
          await saveCursor(pool, event.id);
        }
        console.log(`Stored lottery ${event.parsedJson?.lottery_id ?? '<unknown>'} from tx ${event.id?.txDigest ?? 'n/a'}`);
      }

      if (!response.hasNextPage) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error('Indexer loop failed', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

pollEvents().catch((error) => {
  console.error('Fatal error in lottery indexer', error);
  process.exit(1);
});
