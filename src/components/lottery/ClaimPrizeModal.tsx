import { Dialog, Transition } from '@headlessui/react';
import { SealClient } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LotteryCard } from './types';
import { hasSealConfig, sealConfig } from '../../config/seal';

type Props = {
  open: boolean;
  lottery: LotteryCard | null;
  onClose: () => void;
  currentAddress: string | null;
  onSubmit: (lotteryId: string, sealId: Uint8Array, encryptedInfo: Uint8Array) => void;
  submitting: boolean;
};

type ShippingForm = {
  fullName: string;
  address: string;
  phone: string;
  notes: string;
};

const encoder = new TextEncoder();
const toHex = (bytes: Uint8Array) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');
const defaultForm: ShippingForm = { fullName: '', address: '', phone: '', notes: '' };

export function ClaimPrizeModal({ open, lottery, onClose, currentAddress, onSubmit, submitting }: Props) {
  const [form, setForm] = useState<ShippingForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [encrypting, setEncrypting] = useState(false);

  const configAvailable = hasSealConfig();
const suiClient = useMemo(() => new SuiClient({ url: sealConfig.rpcUrl }), []);
  const sealClient = useMemo(() => {
    if (!configAvailable) return null;
    try {
      return new SealClient({
        suiClient,
        serverConfigs: sealConfig.serverConfigs,
        verifyKeyServers: sealConfig.verifyKeyServers,
      });
    } catch (clientError) {
      console.error('Failed to initialize Seal client', clientError);
      return null;
    }
  }, [suiClient, configAvailable]);

  useEffect(() => {
    if (open) {
      setForm(defaultForm);
      setError(null);
      setEncrypting(false);
    }
  }, [open, lottery]);

  const handleChange =
    (field: keyof ShippingForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!lottery) return;
    if (!sealClient) {
      setError('Seal client is not configured. Please set VITE_SEAL_KEY_SERVERS.');
      return;
    }
    if (!currentAddress) {
      setError('Connect your wallet before claiming.');
      return;
    }
    if (!sealConfig.packageId) {
      setError('Missing WALOTTERY package ID configuration.');
      return;
    }

    setEncrypting(true);
    setError(null);

    try {
      const payload = {
        lotteryId: lottery.id,
        winner: currentAddress,
        shipping: form,
        timestamp: Date.now(),
      };
      const payloadBytes = encoder.encode(JSON.stringify(payload));
      const identityRaw = `${sealConfig.identityPrefix}:${lottery.id}:${currentAddress.toLowerCase()}`;
      const identityBytes = encoder.encode(identityRaw);
      const identityHex = toHex(identityBytes);

      const { encryptedObject } = await sealClient.encrypt({
        threshold: sealConfig.threshold,
        packageId: sealConfig.packageId,
        id: identityHex,
        data: payloadBytes,
      });

      const sealBytes = identityBytes;
      onSubmit(lottery.id, sealBytes, encryptedObject);
      setEncrypting(false);
      onClose();
    } catch (encryptError) {
      console.error('Failed to encrypt shipping info', encryptError);
      setEncrypting(false);
      setError(encryptError instanceof Error ? encryptError.message : 'Failed to encrypt shipping information.');
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => (!encrypting && !submitting ? onClose() : undefined)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-3xl bg-[#0c111c] p-8 text-left align-middle text-white shadow-xl transition-all border border-white/10">
                <Dialog.Title className="text-3xl font-bold mb-4">Claim Prize</Dialog.Title>
                {lottery && (
                  <p className="text-sm text-gray-300 mb-4">
                    Encrypt your shipping details for <span className="font-semibold">{lottery.names[0]}</span>. The ciphertext is
                    stored on-chain, and only you and the lottery creator can decrypt it through Seal.
                  </p>
                )}

                {!configAvailable && (
                  <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                    Seal key servers are not configured. Set VITE_SEAL_KEY_SERVERS with one or more KeyServer object IDs to enable
                    client-side encryption.
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-white">Full Name</label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      placeholder="Jane Doe"
                      value={form.fullName}
                      onChange={handleChange('fullName')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white">Shipping Address</label>
                    <textarea
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white min-h-[100px]"
                      placeholder="Street, City, Country, Postal code"
                      value={form.address}
                      onChange={handleChange('address')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white">Phone / Contact</label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      placeholder="+1 555 123 4567"
                      value={form.phone}
                      onChange={handleChange('phone')}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white">Notes (optional)</label>
                    <textarea
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white min-h-[80px]"
                      placeholder="Delivery instructions or additional details"
                      value={form.notes}
                      onChange={handleChange('notes')}
                    />
                  </div>
                </div>
                {error && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onClose}
                    disabled={encrypting || submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white text-black px-6 py-2 text-sm font-bold hover:bg-sui-green disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSubmit}
                    disabled={!sealClient || encrypting || submitting}
                  >
                    {encrypting || submitting ? 'Submitting…' : 'Encrypt & Submit'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
