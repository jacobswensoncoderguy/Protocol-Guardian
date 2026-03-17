import { Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FloatingShareButton = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
      <button
        onClick={() => navigate('/invite-card')}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center"
      >
        <Share2 className="w-5 h-5" />
      </button>
    </div>
  );
};

export default FloatingShareButton;
