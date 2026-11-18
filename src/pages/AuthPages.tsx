import React from 'react';
import { LoginPage } from './auth/LoginPage';
import { SignupPage } from './auth/SignupPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'forgot';
  onSuccess?: () => void;
  onNavigate: (route: string, param?: string) => void;
}

export const AuthPages: React.FC<AuthPageProps> = ({ initialMode = 'login', onNavigate }) => {
  if (initialMode === 'register') {
    return <SignupPage onNavigate={onNavigate} />;
  }
  if (initialMode === 'forgot') {
    return <ForgotPasswordPage onNavigate={onNavigate} />;
  }
  return <LoginPage onNavigate={onNavigate} />;
};
