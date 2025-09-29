import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

import LanguageToggle from './LanguageToggle';

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  variant?: 'card' | 'immersive';
}>;

const AuthLayout = ({ children, title, variant = 'card' }: AuthLayoutProps) => {
  if (variant === 'immersive') {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <LanguageToggle theme="light" className="absolute right-6 top-6" />
      <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Link to="/" className="text-2xl font-semibold text-brand-700">
            Temple Donor Portal
          </Link>
          <p className="mt-2 text-lg font-medium text-slate-700">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
