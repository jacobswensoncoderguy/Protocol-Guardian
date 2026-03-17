import { useState } from 'react';
import { Mail, Send, Loader2, Check } from 'lucide-react';
import InviteNavBar from '@/components/InviteNavBar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const InviteEmail = () => {
  const { user } = useAuth();
  const inviteUrl = `https://superhumanprotocol.lovable.app/invite?ref=${user?.id ?? ''}`;
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) return;
    setSending(true);
    try {
      // Get display name for the invite email
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user?.id ?? '')
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('send-household-invite', {
        body: {
          inviteeEmail: recipientEmail.trim(),
          inviterName: profileData?.display_name || undefined,
        },
      });

      if (error) {
        toast.error('Failed to send invite');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        setSent(true);
        toast.success('Invite sent!');
        setRecipientEmail('');
        setTimeout(() => setSent(false), 3000);
      }
    } catch {
      toast.error('Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#06090f' }}>
      <InviteNavBar />
      <div className="flex flex-col items-center px-4 py-4 gap-4">

        {/* Send to specific email */}
        <div className="w-full max-w-[600px] space-y-3">
          <label
            className="text-[10px] uppercase tracking-[0.15em] block"
            style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.45)' }}
          >
            Send invite to
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(200,215,230,0.35)' }} />
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="partner@email.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm"
                style={{
                  fontFamily: '"Courier New", monospace',
                  background: 'rgba(255,255,255,0.028)',
                  border: '1px solid rgba(56,189,248,0.18)',
                  color: '#e2e8f0',
                  outline: 'none',
                }}
                disabled={sending}
              />
            </div>
            <button
              onClick={handleSendEmail}
              disabled={!recipientEmail.trim() || sending}
              className="px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 transition-colors"
              style={{
                fontFamily: '"Courier New", monospace',
                background: sent ? 'rgba(52,211,153,0.15)' : 'rgba(56,189,248,0.12)',
                color: sent ? '#34d399' : '#38bdf8',
                border: `1px solid ${sent ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.25)'}`,
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : sent ? (
                <Check className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? '…' : sent ? 'Sent' : 'Send'}
            </button>
          </div>
          <p
            className="text-[10px] leading-relaxed"
            style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.3)' }}
          >
            They'll receive an email invite to join your household.
          </p>
        </div>

        {/* Email preview */}
        <div className="w-full max-w-[600px]">
          <span
            className="text-[9px] uppercase tracking-[0.15em] block mb-2"
            style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.25)' }}
          >
            Preview
          </span>
          <div className="rounded-xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}>
            {/* Header */}
            <div className="px-6 sm:px-8 py-6 sm:py-8" style={{ background: '#06090f' }}>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                <span style={{ color: '#38bdf8' }}>PROTOCOL</span>
                <span style={{ color: 'rgba(200,215,230,0.6)', fontWeight: 400, marginLeft: 8 }}>Guardian</span>
              </h1>
            </div>

            {/* Body */}
            <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-4" style={{ color: '#1a1a2e' }}>
              <p className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                I've been tracking my entire supplement &amp; peptide protocol on{' '}
                <strong>Protocol Guardian</strong> — doses, inventory, reorders, AI insights, all of it.
              </p>
              <p className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                Join my household and we track together.
              </p>

              {/* CTA */}
              <div className="py-2">
                <a
                  href={inviteUrl}
                  className="inline-block px-6 sm:px-8 py-3 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider no-underline"
                  style={{
                    background: '#06090f',
                    color: '#38bdf8',
                    border: '1.5px solid #38bdf8',
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  Join My Household →
                </a>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: '#999', fontFamily: '"Courier New", monospace' }}>
                Or copy this link into your browser:
              </p>
              <p className="text-[11px] break-all leading-relaxed" style={{ color: '#38bdf8', fontFamily: '"Courier New", monospace' }}>
                {inviteUrl}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-4" style={{ borderTop: '1px solid #eee' }}>
              <p className="text-[10px]" style={{ color: '#aaa', fontFamily: '"Courier New", monospace' }}>
                PROTOCOL Guardian — Track, optimize, and sync your protocol.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteEmail;
