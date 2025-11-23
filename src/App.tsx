import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import LotterySection from './components/LotterySection';
import ProcessSection from './components/ProcessSection';
import StatsSection from './components/StatsSection';

const App: React.FC = () => {
  return (
    <div className="bg-black min-h-screen text-white selection:bg-sui-green selection:text-black">
      <Navbar />
      <main>
        <Hero />
        <LotterySection />
        <ProcessSection />
        <StatsSection />
      </main>
      
      <footer className="bg-black border-t border-white/10 py-12 text-center">
        <p className="text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} SuiLotto. Built for Sui Network Hackathon.
        </p>
      </footer>
    </div>
  );
};

export default App;