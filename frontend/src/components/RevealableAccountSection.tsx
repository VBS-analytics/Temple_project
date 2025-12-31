import type { ReactNode } from 'react';

type RevealableAccountSectionProps = {
  children: ReactNode;
  className?: string;
};

const RevealableAccountSection = ({ children, className = '' }: RevealableAccountSectionProps) => (
  <div className={`relative ${className}`}>
    <div className="transition duration-200 opacity-100">{children}</div>
  </div>
);

export default RevealableAccountSection;
