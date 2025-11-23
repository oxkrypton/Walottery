import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseClient,
  createSuiClient,
  fetchLotteryMetadata,
  upsertLotteryRecord,
  type WorkerEnv,
} from '../shared.ts';

interface Env extends WorkerEnv {
  LOTTERY_API_ALLOWED_ORIGINS?: string;
}

type UpsertPayload = {
  lotteryId?: string;
  txDigest?: string;
  eventSeq?: number;
};

const corsHeaders = (origin: string | null, env: Env) => {
  const allowed = env.LOTTERY_API_ALLOWED_ORIGINS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const headers = new Headers({
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });

  if (!origin || !allowed?.length || allowed.includes('*')) {
    headers.set('access-control-allow-origin', '*');
  } else if (allowed.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
  }

  return headers;
};

const withCors = (response: Response, request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin, env);
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });

async function listLotteries(client: SupabaseClient) {
  const { data, error } = await client
    .from('lottery_created_events')
    .select(
      'lottery_id, creator, deadline_ms, total_prize_units, tx_digest, event_seq, emitted_at, raw_event',
    )
    .order('emitted_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function handleUpsert(request: Request, env: Env, supabase: SupabaseClient) {
  const payload = (await request.json().catch(() => null)) as UpsertPayload | null;
  if (!payload?.lotteryId) {
    return jsonResponse({ error: 'lotteryId is required' }, { status: 400 });
  }

  const suiClient = createSuiClient(env);
  const metadata = await fetchLotteryMetadata(suiClient, payload.lotteryId);
  if (!metadata) {
    return jsonResponse({ error: 'Lottery not found on-chain' }, { status: 404 });
  }

  await upsertLotteryRecord(supabase, {
    lottery_id: payload.lotteryId,
    creator: metadata.creator,
    deadline_ms: metadata.deadlineMs,
    total_prize_units: metadata.totalPrizeUnits,
    tx_digest: payload.txDigest ?? '',
    event_seq: payload.eventSeq ?? 0,
    emitted_at: new Date().toISOString(),
    raw_event: metadata.raw,
  });

  return jsonResponse({ success: true });
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const supabase = createSupabaseClient(env);
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/g, '') || '/';

    try {
      if (request.method === 'GET' && pathname === '/lotteries') {
        const rows = await listLotteries(supabase);
        return withCors(jsonResponse(rows), request, env);
      }

      if (request.method === 'POST' && pathname === '/lotteries') {
        const response = await handleUpsert(request, env, supabase);
        return withCors(response, request, env);
      }

      if (pathname === '/') {
        return withCors(
          new Response('walottery api', { headers: { 'content-type': 'text/plain; charset=utf-8' } }),
          request,
          env,
        );
      }

      return withCors(jsonResponse({ error: 'Not found' }, { status: 404 }), request, env);
    } catch (error) {
      console.error('API handler error', error);
      return withCors(jsonResponse({ error: 'Internal error' }, { status: 500 }), request, env);
    }
  },
};
