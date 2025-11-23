import type { ReactNode } from 'react';

export interface LotteryItem {
  id: number;
  name: string;
  price: number; // in SUI
  image: string;
  totalTickets: number;
  soldTickets: number;
  endsAt: string;
}

export interface StepCard {
  id: number;
  title: string;
  description: string;
  icon: ReactNode;
  color: 'blue' | 'green' | 'yellow';
}
