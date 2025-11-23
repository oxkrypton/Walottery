import type { KeyServerConfig } from '@mysten/seal';
import { getFullnodeUrl } from '@mysten/sui/client';

const parseServerConfigs = (): KeyServerConfig[] => {
  const value = import.meta.env.VITE_SEAL_KEY_SERVERS;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') {
            return { objectId: item.trim(), weight: 1 } satisfies KeyServerConfig;
          }
          if (typeof item === 'object' && item.objectId) {
            const weightValue = Number(item.weight ?? 1);
            return {
              objectId: String(item.objectId),
              weight: Number.isFinite(weightValue) && weightValue > 0 ? weightValue : 1,
              apiKeyName: item.apiKeyName ? String(item.apiKeyName) : undefined,
              apiKey: item.apiKey ? String(item.apiKey) : undefined,
            } satisfies KeyServerConfig;
          }
          return null;
        })
        .filter((entry): entry is KeyServerConfig => Boolean(entry));
    }
  } catch {
    // fall back to comma-separated list
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length) {
      return parts.map((objectId) => ({ objectId, weight: 1 }));
    }
  }
  return [];
};

export const sealConfig = {
  serverConfigs: parseServerConfigs(),
  rpcUrl: import.meta.env.VITE_SEAL_RPC_URL ?? import.meta.env.VITE_SUI_RPC_URL ?? getFullnodeUrl('testnet'),
  threshold: Math.max(1, Number(import.meta.env.VITE_SEAL_THRESHOLD ?? 1)),
  packageId: import.meta.env.VITE_WALOTTERY_PACKAGE_ID ?? import.meta.env.VITE_LOTTERY_PACKAGE_ID ?? '',
  identityPrefix: import.meta.env.VITE_SEAL_IDENTITY_PREFIX ?? 'walottery',
  verifyKeyServers: import.meta.env.VITE_SEAL_VERIFY_KEY_SERVERS === 'true',
};

export const hasSealConfig = () =>
  Boolean(sealConfig.serverConfigs.length && sealConfig.packageId && sealConfig.rpcUrl && sealConfig.identityPrefix);
