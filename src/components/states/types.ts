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
  inline: 'p-6 rounded-xl',
  card: 'p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
  fullpage: 'p-12 rounded-3xl max-w-2xl mx-auto my-12',
};
