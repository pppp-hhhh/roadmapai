import type { FC } from 'react';

interface Props {
  size?: number;
  className?: string;
}

/**
 * 品牌印章 — 圆形浮雕徽记,内嵌罗马数字 I
 * 深色 / 浅色双适配,带细金边
 */
const ManuscriptMark: FC<Props> = ({ size = 36, className = '' }) => {
  const id = 'ms-mark-bg';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%"  stopColor="var(--paper)" />
          <stop offset="60%" stopColor="var(--paper-fold)" />
          <stop offset="100%" stopColor="var(--rule)" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id})`} stroke="var(--seal)" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="var(--seal)" strokeWidth="0.6" strokeDasharray="1 1.6" />
      <text
        x="24" y="29"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="700"
        fontSize="18"
        fill="var(--seal)"
      >
        I
      </text>
      <path id="ms-arc-top" d="M 10 24 A 14 14 0 0 1 38 24" fill="none" />
      <text fontFamily="Fraunces, Georgia, serif" fontSize="4.2" fill="var(--ink-fade)" letterSpacing="0.6">
        <textPath href="#ms-arc-top" startOffset="50%" textAnchor="middle">ROADMAP · AI</textPath>
      </text>
      <text x="24" y="40" textAnchor="middle" fontSize="5" fill="var(--gilt)">✦</text>
    </svg>
  );
};

export default ManuscriptMark;
