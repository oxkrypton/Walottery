import React, { useState } from 'react';
import { Menu, X, Wallet } from 'lucide-react';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

type ConnectWalletButtonProps = {
  variant: 'desktop' | 'mobile';
  onRequestClose?: () => void;
};

const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({ variant, onRequestClose }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  const desktopClasses =
    'bg-white text-black hover:bg-sui-green transition-colors px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2';
  const mobileClasses = 'w-full text-left mt-4 bg-white text-black px-4 py-3 rounded-md font-bold';
  const sharedTitle = currentAccount ? 'Disconnect wallet' : undefined;

  const button = (
    <button
      type="button"
      className={variant === 'desktop' ? desktopClasses : mobileClasses}
      onClick={() => onRequestClose?.()}
      title={sharedTitle}
    >
      {variant === 'desktop' && <Wallet size={16} />}
      {currentAccount ? shortenAddress(currentAccount.address) : 'Connect Wallet'}
    </button>
  );

  if (currentAccount) {
    return React.cloneElement(button, {
      onClick: () => {
        onRequestClose?.();
        disconnectWallet();
      },
    });
  }

  return <ConnectModal trigger={button} />;
};

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-sui-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-display font-bold tracking-tighter text-white">
                <span className="text-sui-blue">WAL</span>ottery
              </span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a href="#home" className="hover:text-sui-blue transition-colors px-3 py-2 rounded-md text-sm font-medium">Home</a>
                <a href="#lottery" className="hover:text-sui-blue transition-colors px-3 py-2 rounded-md text-sm font-medium">Prizes</a>
                <a href="#process" className="hover:text-sui-blue transition-colors px-3 py-2 rounded-md text-sm font-medium">How it Works</a>
                <a href="#stats" className="hover:text-sui-blue transition-colors px-3 py-2 rounded-md text-sm font-medium">Stats</a>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <ConnectWalletButton variant="desktop" />
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-sui-black border-b border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a href="#home" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Home</a>
            <a href="#lottery" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Prizes</a>
            <a href="#process" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">How it Works</a>
            <ConnectWalletButton variant="mobile" onRequestClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
