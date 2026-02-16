import { Share2, Mail, MessageSquare, Link } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const FloatingShareButton = () => {
  const url = 'https://superhumanprotocol.lovable.app';

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
          <DropdownMenuItem onClick={() => {
            const body = `Check out SUPERHUMAN Tracker — track your protocol and optimize your performance. Create your account here: ${url}`;
            window.open(`sms:?&body=${encodeURIComponent(body)}`);
          }}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Share via Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            const subject = 'Try SUPERHUMAN Tracker';
            const body = `Check out SUPERHUMAN Tracker — track your protocol and optimize your performance.\n\nCreate your account here: ${url}`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
          }}>
            <Mail className="w-4 h-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            navigator.clipboard.writeText(url);
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
