import { Share2, Mail, MessageSquare, Link } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const FloatingShareButton = () => {
  const { user } = useAuth();
  const baseUrl = 'https://superhumanprotocol.lovable.app';
  const inviteUrl = user ? `${baseUrl}/invite?ref=${user.id}` : `${baseUrl}/invite`;

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
          <DropdownMenuItem onClick={() => {
            const body = `Check out PROTOCOL Guardian — track your protocol and optimize your performance. Create your account here: ${inviteUrl}`;
              window.open(`sms:?&body=${encodeURIComponent(body)}`);
          }}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Share via Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            const subject = 'Try PROTOCOL Guardian';
            const body = `Check out PROTOCOL Guardian — track your protocol and optimize your performance.\n\nCreate your account here: ${inviteUrl}`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
          }}>
            <Mail className="w-4 h-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            navigator.clipboard.writeText(inviteUrl);
            toast.success('Link copied to clipboard!');
          }}>
            <Link className="w-4 h-4 mr-2" />
            Copy Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default FloatingShareButton;
