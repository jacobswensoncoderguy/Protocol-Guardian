import InviteNavBar from '@/components/InviteNavBar';
import { useAuth } from '@/hooks/useAuth';

const InviteEmail = () => {
  const { user } = useAuth();
  const inviteUrl = `https://superhumanprotocol.lovable.app/invite?ref=${user?.id ?? ''}`;

  return (
    <div className="min-h-screen" style={{ background: '#06090f' }}>
      <InviteNavBar />
      <div className="flex justify-center px-4 py-6">
        {/* Email preview */}
        <div className="w-full max-w-[600px] rounded-xl overflow-hidden shadow-2xl" style={{ background: '#ffffff' }}>
          {/* Header */}
          <div className="px-8 py-8" style={{ background: '#06090f' }}>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              <span style={{ color: '#38bdf8' }}>PROTOCOL</span>
              <span style={{ color: 'rgba(200,215,230,0.6)', fontWeight: 400, marginLeft: 8 }}>Guardian</span>
            </h1>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-5" style={{ color: '#1a1a2e' }}>
            <p className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              I've been tracking my entire supplement &amp; peptide protocol on{' '}
              <strong>Protocol Guardian</strong> — doses, inventory, reorders, AI insights, all of it.
            </p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Join my household and we track together.
            </p>

            {/* CTA */}
            <div className="py-3">
              <a
                href={inviteUrl}
                className="inline-block px-8 py-3.5 rounded-lg text-sm font-bold uppercase tracking-wider no-underline"
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

            <p className="text-xs leading-relaxed" style={{ color: '#999', fontFamily: '"Courier New", monospace' }}>
              Or copy this link into your browser:
            </p>
            <p className="text-xs break-all" style={{ color: '#38bdf8', fontFamily: '"Courier New", monospace' }}>
              {inviteUrl}
            </p>
          </div>

          {/* Footer */}
          <div className="px-8 py-5" style={{ borderTop: '1px solid #eee' }}>
            <p className="text-[11px]" style={{ color: '#aaa', fontFamily: '"Courier New", monospace' }}>
              PROTOCOL Guardian — Track, optimize, and sync your protocol.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteEmail;
