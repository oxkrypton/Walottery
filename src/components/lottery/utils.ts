import type { SuiObjectResponse } from '@mysten/sui/client';
import type { LotteryCard } from './types';

const textDecoder = new TextDecoder();

const numberFromValue = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value?.value === 'number') return value.value;
  if (typeof value?.value === 'string') return Number(value.value);
  return 0;
};

const vectorU8ToHex = (value: any): string => {
  if (typeof value === 'string') {
    return value.startsWith('0x') ? value : `0x${value}`;
  }
  if (value?.bytes) {
    return vectorU8ToHex(value.bytes);
  }
  if (value?.fields?.bytes) {
    return vectorU8ToHex(value.fields.bytes);
  }
  if (Array.isArray(value)) {
    const hex = value
      .map((item) => numberFromValue(item))
      .map((num) => Math.max(0, Math.min(255, num)))
      .map((num) => num.toString(16).padStart(2, '0'))
      .join('');
    return hex ? `0x${hex}` : '';
  }
  if (value?.fields?.contents) {
    return vectorU8ToHex(value.fields.contents);
  }
  if (value?.value) {
    return vectorU8ToHex(value.value);
  }
  return '';
};

export const unwrapVector = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.fields?.contents)) return value.fields.contents;
  if (Array.isArray(value?.contents)) return value.contents;
  if (Array.isArray(value?.fields)) return value.fields;
  if (Array.isArray(value?.value)) return value.value;
  return [];
};

export const hexToUtf8 = (hex: string) => {
  const clean = hex?.startsWith('0x') ? hex.slice(2) : hex ?? '';
  if (!clean.length) return '';
  const bytes = clean.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  return textDecoder.decode(new Uint8Array(bytes));
};

export const decodeMoveString = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value?.bytes) return hexToUtf8(value.bytes);
  if (value?.fields?.bytes) return hexToUtf8(value.fields.bytes);
  if (value?.fields?.value) return decodeMoveString(value.fields.value);
  return String(value ?? '');
};

export const parseLotteryResponse = (response: SuiObjectResponse): LotteryCard | null => {
  const content = response.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    return null;
  }

  const fields = content.fields as Record<string, any>;

  const namesField = unwrapVector(fields.names);
  const quantitiesField = unwrapVector(fields.quantities);
  const prizeTemplatesField = unwrapVector(fields.prize_templates ?? fields.prizeTemplates);
  const winnersField = unwrapVector(fields.winners);
  const claimedField = unwrapVector(fields.claimed);
  const winnerPrizeIndexField = unwrapVector(
    fields.winner_prize_template_index ?? fields.winnerPrizeTemplateIndex ?? [],
  );
  const shippingInfoField = unwrapVector(
    fields.shipping_encrypted_infos ?? fields.shippingEncryptedInfos ?? [],
  );
  const shippingSealField = unwrapVector(fields.shipping_seal_ids ?? fields.shippingSealIds ?? []);

  const namesFromTemplates = prizeTemplatesField.map((item: any) =>
    decodeMoveString(item?.fields?.name ?? item?.name),
  );
  const quantitiesFromTemplates = prizeTemplatesField.map((item: any) =>
    Number(item?.fields?.quantity ?? item?.quantity ?? 0),
  );

  const namesRaw = namesField.length
    ? namesField.map((name: any) => decodeMoveString(name))
    : namesFromTemplates;
  const quantitiesRaw = quantitiesField.length
    ? quantitiesField.map((value: any) => Number(value))
    : quantitiesFromTemplates;

  const names = namesRaw.filter((name) => name.length > 0);
  const quantities = quantitiesRaw.length ? quantitiesRaw : new Array(names.length).fill(0);

  const deadlineMs = Number(fields.deadline_ms ?? fields.deadline ?? 0);
  const settled = Boolean(fields.settled);
  const creator = fields.creator ? String(fields.creator) : undefined;

  let participantsCount = 0;
  const participantVector = unwrapVector(fields.participants);
  if (participantVector.length) {
    participantsCount = participantVector.length;
  } else if (typeof fields.participants_count === 'number') {
    participantsCount = fields.participants_count;
  } else if (typeof fields.participants_count === 'string') {
    participantsCount = Number(fields.participants_count);
  }

  const id = response.data?.objectId;
  if (!id || !names.length) {
    return null;
  }

  const winners = winnersField.length ? winnersField.map((addr: any) => String(addr)) : undefined;
  const winnerPrizeIndices = winnerPrizeIndexField.length
    ? winnerPrizeIndexField.map((value: any) => Number(value))
    : undefined;
  const claimed = claimedField.length
    ? claimedField.map((value: any) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'true';
        if (typeof value === 'number') return value !== 0;
        if (typeof value?.fields?.value === 'boolean') return value.fields.value;
        return Boolean(value);
      })
    : undefined;

  return {
    id,
    names,
    quantities,
    settled,
    deadline: deadlineMs,
    participants: participantsCount,
    participantsAddresses: participantVector.length
      ? participantVector.map((addr) => String(addr))
      : undefined,
    creator,
    winners,
    claimed,
    winnerPrizeIndices,
    shippingEncryptedInfos: shippingInfoField.length
      ? shippingInfoField.map((entry: any) => vectorU8ToHex(entry))
      : undefined,
    shippingSealIds: shippingSealField.length
      ? shippingSealField.map((entry: any) => vectorU8ToHex(entry))
      : undefined,
  };
};
