import type { ReactNode } from 'react';

export type StateVariant = 'inline' | 'card' | 'fullpage';

export interface StateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export interface StateProps {
  variant?: StateVariant;
  title?: string;
  description?: string;
  illustration?: ReactNode;
  actions?: StateAction[];
  className?: string;
}

export const STATE_VARIANT_CLASS: Record<StateVariant, string> = {
  inline: 'p-6',
  card: 'p-8 manuscript-card',
  fullpage: 'p-12 max-w-2xl mx-auto my-12 manuscript-card',
};
