import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WorkerEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WALOTTERY_PACKAGE_ID: string;
  SUI_FULLNODE_URL?: string;
  SUI_NETWORK?: string;
  LOTTERY_API_ALLOWED_ORIGINS?: string;
  LOTTERY_DRAW_PRIVATE_KEY?: string;
  SUI_CLOCK_ID?: string;
  SUI_RANDOM_ID?: string;
  LOTTERY_INDEXER_PAGES_PER_RUN?: string;
  LOTTERY_INDEXER_BATCH_SIZE?: string;
  LOTTERY_DRAW_BATCH_SIZE?: string;
  LOTTERY_DRAW_POLL_INTERVAL_MS?: string;
};

export type LotteryRecord = {
  lottery_id: string;
  creator: string;
  deadline_ms: number;
  total_prize_units: number;
  tx_digest: string;
  event_seq: number;
  emitted_at: string;
  raw_event: unknown;
};

export const textDecoder = new TextDecoder();

export const unwrapVector = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray((value as any)?.fields?.contents)) return (value as any).fields.contents;
  if (Array.isArray((value as any)?.contents)) return (value as any).contents;
  if (Array.isArray((value as any)?.fields)) return (value as any).fields;
  if (Array.isArray((value as any)?.value)) return (value as any).value;
  return [];
};

export const hexToUtf8 = (hex?: string): string => {
  const clean = hex?.startsWith('0x') ? hex.slice(2) : hex ?? '';
  if (!clean.length) return '';
  const bytes = clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return textDecoder.decode(new Uint8Array(bytes));
};

export const decodeMoveString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if ((value as any)?.bytes) return hexToUtf8((value as any).bytes);
  if ((value as any)?.fields?.bytes) return hexToUtf8((value as any).fields.bytes);
  if ((value as any)?.fields?.value) return decodeMoveString((value as any).fields.value);
  return String(value ?? '');
};

export const createSupabaseClient = (env: WorkerEnv) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'x-application-name': 'walottery-workers' } },
  });

type NetworkName = Parameters<typeof getFullnodeUrl>[0];

export const createSuiClient = (env: WorkerEnv) => {
  const network = (env.SUI_NETWORK ?? 'testnet') as NetworkName;
  const url = env.SUI_FULLNODE_URL ?? getFullnodeUrl(network);
  return new SuiClient({ url });
};

export async function fetchLotteryMetadata(suiClient: SuiClient, lotteryId: string) {
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

  const fields = (content as any).fields ?? {};
  const creator = fields.creator ?? '0x0';
  const deadlineMs = Number(fields.deadline_ms ?? fields.deadline ?? 0);
  const prizeTemplates = unwrapVector(fields.prize_templates ?? fields.prizeTemplates ?? []);

  const totalPrizeUnits = prizeTemplates.reduce<number>((sum, template) => {
    const quantity = Number((template as any)?.fields?.quantity ?? (template as any)?.quantity ?? 0);
    return sum + quantity;
  }, 0);

  const names = prizeTemplates.map((template) =>
    decodeMoveString((template as any)?.fields?.name ?? (template as any)?.name ?? ''),
  );

  return {
    creator,
    deadlineMs,
    totalPrizeUnits,
    raw: response,
    names,
  };
}

export async function upsertLotteryRecord(client: SupabaseClient, record: LotteryRecord) {
  const { error } = await client
    .from('lottery_created_events')
    .upsert(record, { onConflict: 'lottery_id' });
  if (error) {
    throw new Error(`Failed to upsert lottery: ${error.message}`);
  }
}
