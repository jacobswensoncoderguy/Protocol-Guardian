import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Copy, Check, Loader2 } from 'lucide-react';
import InviteNavBar from '@/components/InviteNavBar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const InviteCard = () => {
  const { user } = useAuth();
  const inviteUrl = `https://superhumanprotocol.lovable.app/invite?ref=${user?.id ?? ''}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAsImage = async () => {
    if (!cardRef.current) return;
    setCopying(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#06090f',
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to generate image');
          setCopying(false);
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          toast.success('Card copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'protocol-guardian-invite.png';
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Card saved as image!');
        }
        setCopying(false);
      }, 'image/png');
    } catch {
      toast.error('Failed to capture card');
      setCopying(false);
    }
  };

  const features = [
    { icon: '🧬', title: 'PROTOCOL SYNC', desc: 'Share and compare stacks in real time' },
    { icon: '📦', title: 'INVENTORY', desc: 'Track every compound, dose & reorder' },
    { icon: '⚡', title: 'AI INSIGHTS', desc: 'Personalized grading & optimization' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#06090f' }}>
      <InviteNavBar />
      <div className="flex flex-col items-center px-4 py-4 gap-4">
        {/* Card container — NOT aspect-square, let content dictate height */}
        <div
          ref={cardRef}
          className="w-full max-w-[540px] relative overflow-hidden rounded-2xl"
          style={{
            background: `
              radial-gradient(ellipse 70% 60% at 15% 15%, rgba(56,189,248,0.13), transparent),
              radial-gradient(ellipse 60% 50% at 85% 85%, rgba(52,211,153,0.10), transparent),
              #06090f
            `,
          }}
        >
          {/* Grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(56,189,248,0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(56,189,248,0.035) 1px, transparent 1px)
              `,
              backgroundSize: '54px 54px',
            }}
          />

          {/* Inner card */}
          <div
            className="relative m-4 sm:m-6 rounded-xl flex flex-col overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.028)',
              border: '1px solid rgba(56,189,248,0.18)',
            }}
          >
            {/* Top gradient line */}
            <div
              className="h-px w-full flex-shrink-0"
              style={{
                background: 'linear-gradient(90deg, transparent, #38bdf8, #34d399, transparent)',
              }}
            />

            <div className="flex flex-col p-4 sm:p-6 gap-3 sm:gap-4">
              {/* Eyebrow */}
              <div className="flex items-center gap-2">
                <div
                  className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                  style={{
                    background: '#34d399',
                    boxShadow: '0 0 8px rgba(52,211,153,0.6)',
                  }}
                />
                <span
                  className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em]"
                  style={{ fontFamily: '"Courier New", monospace', color: 'rgba(52,211,153,0.75)' }}
                >
                  Household Invite
                </span>
              </div>

              {/* Headline */}
              <h1
                className="text-2xl sm:text-3xl leading-tight"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#e2e8f0' }}
              >
                Track with me
                <br />
                on{' '}
                <span style={{ color: '#38bdf8', textShadow: '0 0 20px rgba(56,189,248,0.4)' }}>
                  PROTOCOL
                </span>
                <br />
                Guardian.
              </h1>

              {/* Subheading */}
              <p
                className="text-[10px] sm:text-xs leading-relaxed"
                style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.48)' }}
              >
                Join my household and sync protocols —
                <br />
                doses, stock, reorders, all in one place.
              </p>

              {/* Divider */}
              <div className="flex justify-center">
                <div
                  className="h-px w-full max-w-[360px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }}
                />
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {features.map(f => (
                  <div
                    key={f.title}
                    className="rounded-lg p-2 sm:p-2.5 flex flex-col gap-1"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(56,189,248,0.1)',
                    }}
                  >
                    <span className="text-sm sm:text-base">{f.icon}</span>
                    <span
                      className="text-[7px] sm:text-[8px] uppercase tracking-[0.12em] font-bold"
                      style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.65)' }}
                    >
                      {f.title}
                    </span>
                    <span
                      className="text-[8px] sm:text-[9px] leading-tight"
                      style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.35)' }}
                    >
                      {f.desc}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom row: URL + QR */}
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span
                    className="text-[7px] sm:text-[8px] uppercase tracking-[0.15em] block mb-1"
                    style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.35)' }}
                  >
                    Your Invite Link
                  </span>
                  <span
                    className="text-[8px] sm:text-[9px] font-bold break-all leading-snug block"
                    style={{ fontFamily: '"Courier New", monospace', color: '#38bdf8' }}
                  >
                    superhumanprotocol.lovable.app
                    <br />
                    /invite?ref={user?.id?.slice(0, 8)}…
                  </span>
                </div>
                <div
                  className="flex-shrink-0 rounded-lg overflow-hidden p-1"
                  style={{ background: '#fff' }}
                >
                  <QRCodeSVG
                    value={inviteUrl}
                    size={72}
                    bgColor="#ffffff"
                    fgColor="#06090f"
                    level="M"
                  />
                </div>
              </div>

              {/* Bottom-right branding */}
              <div className="flex justify-end">
                <span
                  className="text-[7px] sm:text-[8px] uppercase tracking-[0.2em]"
                  style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.2)' }}
                >
                  Protocol Guardian
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy as Image button */}
        <button
          onClick={handleCopyAsImage}
          disabled={copying}
          className="w-full max-w-[540px] py-3 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          style={{
            fontFamily: '"Courier New", monospace',
            background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(56,189,248,0.1)',
            color: copied ? '#34d399' : '#38bdf8',
            border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.25)'}`,
          }}
        >
          {copying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copying ? 'Generating…' : copied ? 'Copied!' : 'Copy as Image'}
        </button>
      </div>
    </div>
  );
};

export default InviteCard;
