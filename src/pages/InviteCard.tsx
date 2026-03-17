import { QRCodeSVG } from 'qrcode.react';
import InviteNavBar from '@/components/InviteNavBar';
import { useAuth } from '@/hooks/useAuth';

const InviteCard = () => {
  const { user } = useAuth();
  const inviteUrl = `https://superhumanprotocol.lovable.app/invite?ref=${user?.id ?? ''}`;

  return (
    <div className="min-h-screen" style={{ background: '#06090f' }}>
      <InviteNavBar />
      <div className="flex items-center justify-center px-4 py-6">
        {/* 1080x1080 card container – scales down on mobile */}
        <div
          className="w-full max-w-[540px] aspect-square relative overflow-hidden rounded-2xl"
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
            className="absolute inset-5 sm:inset-8 rounded-xl flex flex-col overflow-hidden"
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

            <div className="flex-1 flex flex-col px-4 sm:px-6 py-4 sm:py-5 min-h-0">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
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
                className="text-xl sm:text-2xl md:text-3xl leading-tight mb-2 sm:mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#e2e8f0' }}
              >
                Track with me
                <br />
                on{' '}
                <span
                  style={{
                    color: '#38bdf8',
                    textShadow: '0 0 20px rgba(56,189,248,0.4)',
                  }}
                >
                  PROTOCOL
                </span>
                <br />
                Guardian.
              </h1>

              {/* Subheading */}
              <p
                className="text-[10px] sm:text-xs leading-relaxed mb-3 sm:mb-4"
                style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.48)' }}
              >
                Join my household and sync protocols —<br />
                doses, stock, reorders, all in one place.
              </p>

              {/* Divider */}
              <div className="flex justify-center mb-3 sm:mb-4">
                <div
                  className="h-px w-[240px] sm:w-[360px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }}
                />
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                {[
                  { icon: '🧬', title: 'PROTOCOL SYNC', desc: 'Share and compare stacks in real time' },
                  { icon: '📦', title: 'INVENTORY', desc: 'Track every compound, dose & reorder' },
                  { icon: '⚡', title: 'AI INSIGHTS', desc: 'Personalized grading & optimization' },
                ].map(f => (
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
                      className="text-[7px] sm:text-[8px] uppercase tracking-[0.15em] font-bold"
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
              <div className="mt-auto flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span
                    className="text-[7px] sm:text-[8px] uppercase tracking-[0.15em] block mb-1"
                    style={{ fontFamily: '"Courier New", monospace', color: 'rgba(200,215,230,0.35)' }}
                  >
                    Your Invite Link
                  </span>
                  <span
                    className="text-[8px] sm:text-[9px] font-bold break-all leading-tight block"
                    style={{ fontFamily: '"Courier New", monospace', color: '#38bdf8' }}
                  >
                    superhumanprotocol.lovable.app/invite?ref={user?.id?.slice(0, 8)}…
                  </span>
                </div>
                <div
                  className="flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ background: '#fff', padding: 4 }}
                >
                  <QRCodeSVG
                    value={inviteUrl}
                    size={80}
                    bgColor="#ffffff"
                    fgColor="#06090f"
                    level="M"
                  />
                </div>
              </div>

              {/* Bottom-right branding */}
              <div className="flex justify-end mt-2">
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
      </div>
    </div>
  );
};

export default InviteCard;
