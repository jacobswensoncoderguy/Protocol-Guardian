import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Zap, Loader2, Mail, Lock, ArrowLeft, Shield, Activity, Brain } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'signup' | 'forgot';

const FEATURES = [
  { icon: Shield, label: 'Protocol Tracking', desc: 'Never miss a dose' },
  { icon: Activity, label: 'Smart Inventory', desc: 'Auto-reorder alerts' },
  { icon: Brain, label: 'AI Analysis', desc: 'Stack optimization' },
];

const Auth = () => {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) sessionStorage.setItem('referrer_id', ref);
  }, []);

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      console.error('Sign in error:', error);
      toast.error('Google sign-in failed. Please try again.');
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success('Check your email for a verification link!'); setMode('login'); }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email address'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success('Password reset email sent!'); setMode('login'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    window.location.href = '/';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm space-y-5 text-center relative z-10">
        {/* Brand */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-1">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="text-gradient-cyan">PROTOCOL</span>
              <span className="text-muted-foreground font-medium ml-2">Guardian</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 tracking-wide uppercase" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em' }}>
              Track · Optimize · Perform
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/50 text-[10px] text-muted-foreground">
              <f.icon className="w-3 h-3 text-primary/70" />
              <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-secondary/50 active:scale-[0.98] transition-all text-sm font-medium text-foreground shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-[10px]">
            <span className="bg-background px-3 text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace" }}>or</span>
          </div>
        </div>

        {/* Email forms */}
        {mode === 'forgot' ? (
          <form onSubmit={handleForgotPassword} className="space-y-3 text-left">
            <button type="button" onClick={() => setMode('login')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to login
            </button>
            <p className="text-sm text-muted-foreground">Enter your email to receive a password reset link.</p>
            <AuthInput icon={Mail} type="email" value={email} onChange={setEmail} placeholder="Email address" />
            <AuthButton loading={submitting}>Send Reset Link</AuthButton>
          </form>
        ) : (
          <form onSubmit={mode === 'login' ? handleEmailSignIn : handleEmailSignUp} className="space-y-3">
            <AuthInput icon={Mail} type="email" value={email} onChange={setEmail} placeholder="Email address" />
            <AuthInput icon={Lock} type="password" value={password} onChange={setPassword} placeholder="Password" minLength={6} />
            {mode === 'signup' && (
              <AuthInput icon={Lock} type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password" minLength={6} />
            )}
            <AuthButton loading={submitting}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </AuthButton>
            {mode === 'login' && (
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </button>
            )}
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">Sign up</button></>
          ) : mode === 'signup' ? (
            <>Already have an account? <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">Sign in</button></>
          ) : null}
        </p>

        <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>
          <Shield className="w-3 h-3" />
          End-to-end encrypted · Your data stays private
        </p>
      </div>
    </div>
  );
};

/* Reusable sub-components */
const AuthInput = ({ icon: Icon, type, value, onChange, placeholder, minLength }: {
  icon: React.ElementType; type: string; value: string; onChange: (v: string) => void; placeholder: string; minLength?: number;
}) => (
  <div className="relative group">
    <Icon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required minLength={minLength}
      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
    />
  </div>
);

const AuthButton = ({ loading, children }: { loading: boolean; children: React.ReactNode }) => (
  <button
    type="submit" disabled={loading}
    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

export default Auth;
