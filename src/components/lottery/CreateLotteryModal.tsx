import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

type CreateLotteryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clockObjectId: string;
  defaultPackageId: string;
  onLotteryCreated?: (lotteryId: string) => void;
};

export function CreateLotteryModal({
  isOpen,
  onClose,
  clockObjectId,
  defaultPackageId,
  onLotteryCreated,
}: CreateLotteryModalProps) {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [prizes, setPrizes] = useState([{ name: '', quantity: '' }]);
  const [deadline, setDeadline] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setPrizes([{ name: '', quantity: '' }]);
    setDeadline('');
    setFeedback(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updatePrize = (index: number, field: 'name' | 'quantity', value: string) => {
    setPrizes((prev) =>
      prev.map((prize, idx) => (idx === index ? { ...prize, [field]: value } : prize)),
    );
  };

  const addPrize = () => {
    setPrizes((prev) => [{ name: '', quantity: '' }, ...prev]);
  };

  const removePrize = (index: number) => {
    setPrizes((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = () => {
    setFeedback(null);

    if (!currentAccount) {
      setFeedback('Please connect a wallet before creating a lottery.');
      return;
    }

    const trimmedPackageId = defaultPackageId.trim();
    if (!trimmedPackageId) {
      setFeedback('Package ID is missing. Please configure VITE_WALOTTERY_PACKAGE_ID.');
      return;
    }

    const parsedNames = prizes.map((prize) => prize.name.trim());
    const parsedQuantities = prizes.map((prize) => prize.quantity.trim());

    if (!parsedNames.length || parsedNames.some((value) => !value)) {
      setFeedback('Please provide a name for every prize tier.');
      return;
    }

    if (parsedQuantities.some((value) => !value)) {
      setFeedback('Please provide a quantity for every prize tier.');
      return;
    }

    const quantityNumbers = parsedQuantities.map((value) => Number(value));
    if (quantityNumbers.some((value) => Number.isNaN(value) || value <= 0)) {
      setFeedback('Quantities must be positive integers.');
      return;
    }

    const deadlineMs = Date.parse(deadline);
    if (Number.isNaN(deadlineMs) || deadlineMs <= Date.now()) {
      setFeedback('Pick a deadline that is later than the current time.');
      return;
    }

    const quantityVector = quantityNumbers.map((value) => BigInt(value));
    const tx = new Transaction();
    tx.moveCall({
      target: `${trimmedPackageId}::lottery_creation::create_lottery`,
      arguments: [
        tx.pure.vector('string', parsedNames),
        tx.pure.vector('u64', quantityVector),
        tx.pure.u64(BigInt(deadlineMs)),
        tx.object(clockObjectId),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          const digest = (result as any)?.digest;
          setFeedback(
            digest
              ? `Transaction submitted (digest: ${digest}). Waiting for confirmation...`
              : 'Transaction submitted. Waiting for confirmation...',
          );
          setPrizes([{ name: '', quantity: '' }]);
          setDeadline('');
          if (digest && onLotteryCreated) {
            try {
              let receipt: any;
              const clientAny = suiClient as any;
              if (typeof clientAny.waitForTransactionBlock === 'function') {
                receipt = await clientAny.waitForTransactionBlock({
                  digest,
                  options: {
                    showEffects: true,
                    showObjectChanges: true,
                  },
                });
              } else {
                await suiClient.waitForTransaction({
                  digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                  },
                });
                receipt = await suiClient.getTransactionBlock({
                  digest,
                  options: {
                    showEffects: true,
                    showObjectChanges: true,
                  },
                });
              }

              const createdLotteryFromChanges = receipt.objectChanges?.find(
                (change: any) =>
                  change.type === 'created' &&
                  'objectType' in change &&
                  typeof change.objectType === 'string' &&
                  change.objectType.includes('lottery_state::Lottery'),
              );

              const createdLotteryFromEffects = receipt.effects?.created?.find(
                (item: any) => item.reference?.objectId && item.owner?.Shared,
              );

              const createdId =
                (createdLotteryFromChanges && 'objectId' in createdLotteryFromChanges
                  ? createdLotteryFromChanges.objectId
                  : null) ||
                createdLotteryFromEffects?.reference?.objectId ||
                null;

              if (createdId) {
                setFeedback(`Lottery created! Object ID: ${createdId}`);
                onLotteryCreated(createdId);
              } else {
                setFeedback(
                  `Transaction confirmed (digest: ${digest}), but no Lottery object was found. Please check the Explorer.`,
                );
              }
            } catch (queryError) {
              console.error('Failed to fetch created lottery object', queryError);
              setFeedback(`Transaction confirmed, but fetching the Lottery object failed: ${String(queryError)}`);
            }
          } else if (!digest) {
            setFeedback('Transaction completed, but no digest was returned.');
          }
        },
        onError: (error) => {
          setFeedback(`Creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-sui-dark-gray p-6 shadow-2xl flex flex-col max-h-[90vh] min-h-[60vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <p className="text-xs uppercase text-sui-blue tracking-[0.3em]">Create Lottery</p>
            <h3 className="text-3xl font-display font-bold mt-1">Publish a new Lottery</h3>
          </div>
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10" onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto pr-2 flex-1 min-h-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Prize tiers</label>
              <button
                type="button"
                onClick={addPrize}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                <Plus size={14} /> Add prize
              </button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 -mr-2 rounded-2xl">
              {prizes.map((prize, index) => (
                <div
                  key={`prize-${index}`}
                  className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <input
                    type="text"
                    placeholder="Prize description"
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    value={prize.name}
                    onChange={(event) => updatePrize(index, 'name', event.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    value={prize.quantity}
                    onChange={(event) => updatePrize(index, 'quantity', event.target.value)}
                  />
                  {prizes.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-gray-400 hover:text-white"
                      onClick={() => removePrize(index)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs text-gray-600">&nbsp;</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm flex flex-col items-center">
              <label className="text-sm font-semibold text-white">Deadline</label>
              <input
                type="datetime-local"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white text-center"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-sui-blue">{feedback}</div>
          )}

          <div className="flex justify-end gap-3 pt-4 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!currentAccount || isPending}
              className="rounded-full bg-white text-black px-6 py-2 text-sm font-bold hover:bg-sui-green disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Submitting…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
