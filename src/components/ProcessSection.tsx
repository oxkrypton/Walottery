import React from 'react';
import { Database, FileCode, Lock } from 'lucide-react';
import { StepCard } from '../types';

const STEPS: StepCard[] = [
  {
    id: 1,
    title: 'STORE DATA ANYWHERE',
    description:
      "SuiLotto works with Walrus and other storage solutions. Encryption is tied to the data itself, not its location.",
    icon: <Database size={64} className="text-black/20 rotate-12" />,
    color: 'blue',
  },
  {
    id: 2,
    title: 'SET POLICIES THAT ENFORCE THEMSELVES',
    description: 'Define onchain access permissions using Move smart contracts on Sui.',
    icon: <FileCode size={64} className="text-black/20" />,
    color: 'green',
  },
  {
    id: 3,
    title: 'ENCRYPT AT THE SOURCE',
    description: "Use SEAL encryption to protect content before it leaves the user's environment.",
    icon: <Lock size={64} className="text-black/20" />,
    color: 'yellow',
  },
];

const ProcessSection: React.FC = () => {
  return (
    <section
      id="process"
      className="bg-black text-white py-24 relative border-t border-white/10 min-h-screen flex flex-col justify-center"
    >
      <div className="absolute top-8 left-8 w-6 h-6 border-t border-l border-white/50 rounded-tl-lg"></div>
      <div className="absolute top-8 right-8 w-6 h-6 border-t border-r border-white/50 rounded-tr-lg"></div>
      <div className="absolute bottom-8 left-8 w-6 h-6 border-b border-l border-white/50 rounded-bl-lg"></div>
      <div className="absolute bottom-8 right-8 w-6 h-6 border-b border-r border-white/50 rounded-br-lg"></div>

      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-16">
          <h2 className="text-5xl md:text-7xl font-display font-bold tracking-tighter uppercase leading-[0.9] max-w-5xl">
            DEFINE YOUR <br />
            CONFIGURATION. SEAL <br />
            HANDLES THE REST.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`
                min-h-[400px] rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden transition-transform hover:-translate-y-2 duration-300
                ${step.color === 'blue' ? 'bg-sui-blue text-black' : ''}
                ${step.color === 'green' ? 'bg-sui-green text-black' : ''}
                ${step.color === 'yellow' ? 'bg-sui-yellow text-black' : ''}
              `}
            >
              <div className="absolute top-8 right-8 transform rotate-12 scale-150">{step.icon}</div>

              <div className="flex-grow"></div>

              <div className="z-10 mt-auto">
                <h3 className="text-3xl font-display font-bold mb-4 uppercase leading-tight tracking-tight">
                  {step.title}
                </h3>
                <p className="text-lg font-medium leading-snug opacity-90">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;
