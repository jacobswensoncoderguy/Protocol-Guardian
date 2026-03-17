import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import InviteNavBar from '@/components/InviteNavBar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const InviteWhatsApp = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://superhumanprotocol.lovable.app/invite?ref=${user?.id ?? ''}`;

  const plainText = `🧬 *PROTOCOL Guardian* — Join My Household

I've been tracking my entire supplement & peptide protocol on an app called *Protocol Guardian* — doses, inventory, reorders, AI insights, all of it.

Join my household and we track _together_ 💊

*Sign up here 👇*
${inviteUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#06090f' }}>
      <InviteNavBar />
      <div className="flex justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4">
          {/* Message preview */}
          <div
            className="rounded-xl p-5 whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              fontFamily: '"Courier New", monospace',
              color: 'rgba(200,215,230,0.7)',
              background: 'rgba(255,255,255,0.028)',
              border: '1px solid rgba(56,189,248,0.18)',
            }}
          >
            <span>🧬 </span>
            <strong style={{ color: '#e2e8f0' }}>PROTOCOL Guardian</strong>
            <span> — Join My Household</span>
            <br /><br />
            <span>I've been tracking my entire supplement &amp; peptide protocol on an app called </span>
            <strong style={{ color: '#e2e8f0' }}>Protocol Guardian</strong>
            <span> — doses, inventory, reorders, AI insights, all of it.</span>
            <br /><br />
            <span>Join my household and we track </span>
            <em>together</em>
            <span> 💊</span>
            <br /><br />
            <strong style={{ color: '#e2e8f0' }}>Sign up here 👇</strong>
            <br />
            <span style={{ color: '#38bdf8' }}>{inviteUrl}</span>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            style={{
              fontFamily: '"Courier New", monospace',
              background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(56,189,248,0.1)',
              color: copied ? '#34d399' : '#38bdf8',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.25)'}`,
            }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteWhatsApp;
