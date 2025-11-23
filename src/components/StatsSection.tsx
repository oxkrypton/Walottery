import React from 'react';
import { Trophy, Users, Globe, Activity, ExternalLink } from 'lucide-react';

const StatsSection: React.FC = () => {
  return (
    <section id="stats" className="py-24 bg-sui-dark-gray border-t border-white/10 min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-16">
          <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tighter">
            PROTOCOL <span className="text-sui-green">METRICS</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl">
            Transparent, immutable, and verifiable. Every ticket, draw, and winner is recorded on the Sui Network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-auto md:grid-rows-2 gap-6 h-auto md:h-[600px]">
            
            {/* Large Block - TVL */}
            <div className="col-span-1 md:col-span-2 row-span-2 bg-black rounded-3xl p-8 border border-white/10 flex flex-col justify-between group hover:border-sui-green/50 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sui-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex justify-between items-start relative z-10">
                    <div className="p-3 bg-white/10 rounded-xl text-sui-green">
                        <Trophy size={32} />
                    </div>
                    <button className="flex items-center gap-2 text-sm font-mono text-gray-500 hover:text-white transition-colors">
                        VIEW EXPLORER <ExternalLink size={14} />
                    </button>
                </div>
                
                <div className="relative z-10">
                    <h3 className="text-6xl md:text-8xl font-display font-bold text-white mb-2 tracking-tighter">$2.4M</h3>
                    <p className="text-gray-400 text-lg uppercase tracking-widest font-mono">Total Value Distributed</p>
                    
                    {/* Bar Chart Visual */}
                    <div className="mt-12 h-32 flex items-end gap-3">
                        {[40, 60, 45, 70, 55, 80, 90, 65, 85, 100, 75, 60].map((h, i) => (
                            <div 
                                key={i} 
                                className="flex-1 bg-white/10 rounded-t-sm hover:bg-sui-green transition-colors duration-300" 
                                style={{height: `${h}%`}}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Medium Block - Participants */}
            <div className="col-span-1 md:col-span-2 bg-sui-blue text-black rounded-3xl p-8 border border-white/10 flex items-center justify-between hover:scale-[1.01] transition-transform relative overflow-hidden">
                 <div className="absolute -bottom-10 -right-10 text-black/10 rotate-12 transform">
                    <Users size={200} />
                 </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-black/20 px-3 py-1 rounded-full font-mono text-xs font-bold uppercase">Community</span>
                    </div>
                    <h3 className="text-6xl font-display font-bold tracking-tighter">12.4K</h3>
                    <p className="font-medium opacity-80 text-lg">Active Participants</p>
                </div>
                <div className="relative z-10 w-24 h-24 rounded-full border-4 border-black/10 border-t-black animate-spin-slow"></div>
            </div>

            {/* Small Block - Countries */}
            <div className="bg-[#1A1A1A] text-white rounded-3xl p-8 flex flex-col justify-between hover:bg-[#222] transition-colors border border-white/10">
                <Globe size={32} className="mb-4 text-sui-yellow" />
                <div>
                    <h3 className="text-4xl font-bold font-display tracking-tight">35+</h3>
                    <p className="font-mono text-sm text-gray-400">Countries Shipped</p>
                </div>
            </div>

            {/* Small Block - Finality */}
            <div className="bg-sui-yellow text-black rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.02] transition-transform">
                <Activity size={32} className="mb-4" />
                <div>
                    <h3 className="text-4xl font-bold font-display tracking-tight">~400ms</h3>
                    <p className="font-mono text-sm opacity-80">Finality Time</p>
                </div>
            </div>

        </div>
        
        <div className="mt-12 flex justify-center">
             <p className="text-gray-600 text-xs font-mono uppercase tracking-widest">
                Contract: <span className="text-white hover:text-sui-green cursor-pointer transition-colors">0x7f...3a9b</span>
             </p>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
