'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/stores/app-store';
import { Mail, Lock, User, Building2, Globe, Briefcase } from 'lucide-react';

const LOGIN_COPY = {
  bn: {
    switchLanguage: 'English', subtitle: 'আপনার মার্কেটিং ও সেটআপের নিরাপদ ঠিকানা',
    signIn: 'সাইন ইন', signUp: 'অ্যাকাউন্ট খুলুন', welcome: 'ফিরে আসায় স্বাগতম', description: 'শুরু করতে আপনার অ্যাকাউন্টে সাইন ইন করুন।',
    account: 'অ্যাকাউন্ট আইডি (ইমেইল বা ফোন)', password: 'পাসওয়ার্ড', passwordPlaceholder: 'পাসওয়ার্ড দিন', signingIn: 'সাইন ইন হচ্ছে…',
    createTitle: 'আপনার অ্যাকাউন্ট তৈরি করুন', createDescription: 'আপনার মার্কেটিং যাত্রা শুরু করুন।', name: 'পুরো নাম', email: 'ইমেইল',
    createPassword: 'পাসওয়ার্ড তৈরি করুন', company: 'প্রতিষ্ঠান', industry: 'ইন্ডাস্ট্রি', creating: 'অ্যাকাউন্ট তৈরি হচ্ছে…', create: 'অ্যাকাউন্ট তৈরি করুন',
  },
  en: {
    switchLanguage: 'বাংলা', subtitle: 'AI-Powered Marketing Operating System',
    signIn: 'Sign In', signUp: 'Sign Up', welcome: 'Welcome back', description: 'Sign in to get started with your account.',
    account: 'Account ID (email or phone)', password: 'Password', passwordPlaceholder: 'Enter password', signingIn: 'Signing in…',
    createTitle: 'Create your account', createDescription: 'Start your AI marketing journey.', name: 'Full Name', email: 'Email',
    createPassword: 'Create password', company: 'Company', industry: 'Industry', creating: 'Creating account…', create: 'Create Account',
  },
} as const;

const LOGIN_ERRORS_BN: Record<string, string> = {
  'Invalid credentials': 'অ্যাকাউন্ট আইডি বা পাসওয়ার্ড সঠিক নয়।',
  'A secure HTTPS connection is required.': 'নিরাপদ HTTPS সংযোগ ব্যবহার করুন।',
  'Account ID and password are required': 'অ্যাকাউন্ট আইডি ও পাসওয়ার্ড দিন।',
  'Too many attempts. Please wait before trying again.': 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।',
  'Unable to sign in right now': 'এখন সাইন ইন করা যাচ্ছে না। আবার চেষ্টা করুন।',
  'Email, password, and name are required': 'নাম, ইমেইল ও পাসওয়ার্ড দিন।',
  'Enter a valid email address': 'সঠিক ইমেইল ঠিকানা দিন।',
  'Password must be at least 12 characters': 'পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।',
  'Email already registered': 'এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে।',
};

export function LoginView() {
  const { setUser, setupLanguage: language, setSetupLanguage } = useAppStore();
  const t = LOGIN_COPY[language];
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previous; };
  }, [language]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ account_id: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', name: '', companyName: '', industry: '', country: '' });

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('mos_token', data.token);
      setUser({ ...data.user, token: data.token });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoginForm((form) => ({ ...form, password: '' }));
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('mos_token', data.token);
      setUser({ ...data.user, token: data.token });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegisterForm((form) => ({ ...form, password: '' }));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-background to-accent/5">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Image
              src="/kexsio-logo.png"
              alt="Kexsio MarketingOS"
              width={48}
              height={48}
              className="rounded-xl"
              priority
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Kexsio MarketingOS
            </h1>
          </div>
          <p className="text-muted-foreground">{t.subtitle}</p>
          <Button variant="ghost" size="sm" className="mt-3 rounded-full text-xs" onClick={() => setSetupLanguage(language === 'bn' ? 'en' : 'bn')}><Globe className="mr-1.5 h-3.5 w-3.5" />{t.switchLanguage}</Button>
        </div>

        <Card className="glass border-border/50 shadow-xl">
          <Tabs defaultValue="login" onValueChange={() => { setError(''); setLoginForm((form) => ({ ...form, password: '' })); setRegisterForm((form) => ({ ...form, password: '' })); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">{t.signIn}</TabsTrigger>
              <TabsTrigger value="register">{t.signUp}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{t.welcome}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-account">{t.account}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-account"
                      type="text"
                      placeholder="you@company.com or +880…"
                      value={loginForm.account_id}
                      autoComplete="username"
                      onChange={(e) => setLoginForm({ ...loginForm, account_id: e.target.value })}
                      className="pl-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder={t.passwordPlaceholder}
                      value={loginForm.password}
                      autoComplete="current-password"
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                {error && <p role="alert" className="text-destructive text-sm">{language === 'bn' ? (LOGIN_ERRORS_BN[error] || error) : error}</p>}
                <Button className="w-full bg-gradient-to-r from-primary to-chart-2 hover:opacity-90" onClick={handleLogin} disabled={loading}>
                  {loading ? t.signingIn : t.signIn}
                </Button>
              </CardContent>
            </TabsContent>

            <TabsContent value="register">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{t.createTitle}</CardTitle>
                <CardDescription>{t.createDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="register-name">{t.name}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-name" autoComplete="name" placeholder="John Doe" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-email" autoComplete="email" type="email" placeholder="you@company.com" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">{t.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-password" autoComplete="new-password" type="password" placeholder={t.createPassword} value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="pl-10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="register-company">{t.company}</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="register-company" placeholder={t.company} value={registerForm.companyName} onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-industry">{t.industry}</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="register-industry" placeholder={t.industry} value={registerForm.industry} onChange={(e) => setRegisterForm({ ...registerForm, industry: e.target.value })} className="pl-10" />
                    </div>
                  </div>
                </div>
                {error && <p role="alert" className="text-destructive text-sm">{language === 'bn' ? (LOGIN_ERRORS_BN[error] || error) : error}</p>}
                <Button className="w-full bg-gradient-to-r from-primary to-chart-2 hover:opacity-90" onClick={handleRegister} disabled={loading}>
                  {loading ? t.creating : t.create}
                </Button>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </div>
  );
}
