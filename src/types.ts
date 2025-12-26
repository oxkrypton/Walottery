import type { ReactNode } from 'react';

export interface StepCard {
  id: number;
  title: string;
  description: string;
  icon: ReactNode;
  color: 'blue' | 'green' | 'yellow';
}
