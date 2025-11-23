import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const PORT = Number(process.env.PORT ?? 4000);
const SUI_NETWORK = process.env.SUI_NETWORK ?? 'testnet';
const RPC_URL = process.env.SUI_FULLNODE_URL ?? getFullnodeUrl(SUI_NETWORK);
const suiClient = new SuiClient({ url: RPC_URL });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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

const ENSURE_COLUMNS = `
  ALTER TABLE IF EXISTS lottery_created_events
    ADD COLUMN IF NOT EXISTS total_prize_units BIGINT NOT NULL DEFAULT 0;
`;

async function initializeDatabase() {
  await pool.query(CREATE_EVENTS_TABLE);
  await pool.query(ENSURE_COLUMNS);
}

const app = express();
app.use(cors());
app.use(express.json());

const unwrapVector = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.fields?.contents)) return value.fields.contents;
  if (Array.isArray(value?.contents)) return value.contents;
  if (Array.isArray(value?.fields)) return value.fields;
  if (Array.isArray(value?.value)) return value.value;
  return [];
};

const hexToUtf8 = (hex) => {
  const clean = hex?.startsWith('0x') ? hex.slice(2) : hex ?? '';
  if (!clean.length) return '';
  const bytes = clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return new TextDecoder().decode(new Uint8Array(bytes));
};

const decodeMoveString = (value) => {
  if (typeof value === 'string') return value;
  if (value?.bytes) return hexToUtf8(value.bytes);
  if (value?.fields?.bytes) return hexToUtf8(value.fields.bytes);
  if (value?.fields?.value) return decodeMoveString(value.fields.value);
  return String(value ?? '');
};

async function fetchLotteryMetadata(lotteryId) {
  const response = await suiClient.getObject({
    id: lotteryId,
    options: {
      showContent: true,
    },
  });

  const content = response.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    return null;
  }
  const fields = content.fields;
  const creator = fields.creator ?? '0x0';
  const deadlineMs = Number(fields.deadline_ms ?? fields.deadline ?? 0);
  const prizeTemplates = unwrapVector(fields.prize_templates ?? fields.prizeTemplates ?? []);

  const totalPrizeUnits = prizeTemplates.reduce(
    (sum, template) => sum + Number(template?.fields?.quantity ?? template?.quantity ?? 0),
    0,
  );

  const names = prizeTemplates.map((template) =>
    decodeMoveString(template?.fields?.name ?? template?.name ?? ''),
  );

  return {
    creator,
    deadlineMs,
    totalPrizeUnits,
    raw: response,
    names,
  };
}

app.get('/lotteries', async (_, res) => {
  try {
    const result = await pool.query(
      `
        SELECT lottery_id,
               creator,
               deadline_ms,
               total_prize_units,
               tx_digest,
               event_seq,
               emitted_at,
               raw_event
        FROM lottery_created_events
        ORDER BY emitted_at DESC
        LIMIT 50;
      `,
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch lotteries', error);
    res.status(500).json({ error: 'Failed to fetch lotteries' });
  }
});

app.post('/lotteries', async (req, res) => {
  try {
    const lotteryId = req.body?.lotteryId;
    if (!lotteryId) {
      return res.status(400).json({ error: 'lotteryId is required' });
    }

    const metadata = await fetchLotteryMetadata(lotteryId);
    if (!metadata) {
      return res.status(404).json({ error: 'Lottery not found on-chain' });
    }

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
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7::jsonb)
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
        metadata.creator,
        metadata.deadlineMs,
        metadata.totalPrizeUnits,
        req.body?.txDigest ?? '',
        req.body?.eventSeq ?? 0,
        JSON.stringify(metadata.raw),
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to upsert lottery', error);
    res.status(500).json({ error: 'Failed to sync lottery' });
  }
});

let server;

initializeDatabase()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Lottery API listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });

const shutdown = () => {
  server.close(() => {
    pool.end().catch((err) => console.error('Failed to close pool', err));
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
