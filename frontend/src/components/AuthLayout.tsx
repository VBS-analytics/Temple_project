import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ children, title }: PropsWithChildren<{ title: string }>) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
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

export default AuthLayout;
