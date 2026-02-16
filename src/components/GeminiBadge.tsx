const GeminiBadge = () => (
  <div className="flex items-center justify-center gap-1.5 py-1.5">
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="url(#gemini-grad)" />
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
    </svg>
    <span className="text-[9px] text-muted-foreground/60 tracking-wide">Powered by Google Gemini</span>
  </div>
);

export default GeminiBadge;
