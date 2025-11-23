import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20 bg-sui-black">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sui-blue/20 rounded-full blur-[128px] -z-10"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sui-green/10 rounded-full blur-[128px] -z-10"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-sui-green animate-pulse"></span>
          <span className="text-xs font-mono uppercase tracking-widest text-gray-300">Live on Sui Network</span>
        </div>
        
        <h1 className="text-6xl md:text-9xl font-display font-bold leading-[0.9] mb-6 tracking-tighter text-white">
          REAL GOODS.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sui-blue via-sui-green to-sui-yellow">
            ON-CHAIN.
          </span>
        </h1>
        
        <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-400 font-light leading-relaxed">
          The first verifiable physical lottery built on Sui. Win real-world assets, verified by Move smart contracts and shipped globally.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a href="#lottery" className="group bg-white text-black px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 hover:bg-sui-green transition-all duration-300 hover:scale-105">
            Start Winning
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#process" className="px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 text-white border border-white/20 hover:bg-white/10 transition-all">
            How it Works
            <ShieldCheck className="w-5 h-5" />
          </a>
        </div>

        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-white/10 pt-10">
            
        </div>
      </div>
    </section>
  );
};

export default Hero;
