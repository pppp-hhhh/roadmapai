import type { FC, SVGProps } from 'react';

const baseProps: SVGProps<SVGSVGElement> = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 240 240',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'w-40 h-40 text-gray-300 dark:text-gray-600',
};

const BookIllustration: FC = () => (
  <svg {...baseProps}>
    <path d="M40 50 L120 70 L200 50 L200 200 L120 220 L40 200 Z" />
    <path d="M120 70 L120 220" />
    <path d="M70 100 L100 105" />
    <path d="M70 120 L100 125" />
    <path d="M140 100 L170 95" />
    <path d="M140 120 L170 115" />
  </svg>
);

const StarIllustration: FC = () => (
  <svg {...baseProps}>
    <path d="M120 50 L138 102 L194 102 L148 134 L166 186 L120 154 L74 186 L92 134 L46 102 L102 102 Z" />
  </svg>
);

const CheckIllustration: FC = () => (
  <svg {...baseProps}>
    <circle cx="120" cy="120" r="84" />
    <path d="M80 122 L110 152 L160 92" />
  </svg>
);

const SearchIllustration: FC = () => (
  <svg {...baseProps}>
    <circle cx="100" cy="100" r="48" />
    <path d="M138 138 L186 186" />
  </svg>
);

const NetworkDownIllustration: FC = () => (
  <svg {...baseProps}>
    <path d="M50 100 Q120 60 190 100" />
    <path d="M70 130 Q120 100 170 130" />
    <path d="M90 160 Q120 145 150 160" />
    <path d="M50 50 L190 200" />
    <line x1="120" y1="200" x2="120" y2="200" />
  </svg>
);

const KeyIllustration: FC = () => (
  <svg {...baseProps}>
    <circle cx="80" cy="120" r="32" />
    <path d="M112 120 L200 120" />
    <path d="M170 120 L170 150" />
    <path d="M195 120 L195 140" />
  </svg>
);

const LockIllustration: FC = () => (
  <svg {...baseProps}>
    <rect x="60" y="100" width="120" height="100" rx="8" />
    <path d="M80 100 L80 70 Q80 40 120 40 Q160 40 160 70 L160 100" />
    <circle cx="120" cy="150" r="10" />
  </svg>
);

const BugIllustration: FC = () => (
  <svg {...baseProps}>
    <ellipse cx="120" cy="130" rx="50" ry="60" />
    <path d="M120 70 L120 50" />
    <path d="M90 60 L70 50" />
    <path d="M150 60 L170 50" />
    <path d="M70 130 L40 130" />
    <path d="M170 130 L200 130" />
    <path d="M70 165 L50 185" />
    <path d="M170 165 L190 185" />
    <circle cx="108" cy="120" r="4" />
    <circle cx="132" cy="120" r="4" />
  </svg>
);

export {
  BookIllustration,
  StarIllustration,
  CheckIllustration,
  SearchIllustration,
  NetworkDownIllustration,
  KeyIllustration,
  LockIllustration,
  BugIllustration,
};
