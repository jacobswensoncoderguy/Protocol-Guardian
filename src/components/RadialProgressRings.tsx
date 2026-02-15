interface RingProps {
  radius: number;
  progress: number; // 0-100
  color: string;
  label: string;
  strokeWidth?: number;
}

const Ring = ({ radius, progress, color, strokeWidth = 3 }: RingProps) => {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <circle
      cx="50%"
      cy="50%"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      strokeLinecap="round"
      transform="rotate(-90 100 100)"
      className="transition-all duration-1000 ease-out"
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
};

interface RadialProgressRingsProps {
  goalProgress: number;
  protocolScore: number;
  bodyCoverage: number;
  size?: number;
  className?: string;
}

const RadialProgressRings = ({ goalProgress, protocolScore, bodyCoverage, size = 200, className = '' }: RadialProgressRingsProps) => {
  const viewBox = '0 0 200 200';
  const rings = [
    { radius: 90, progress: goalProgress, color: 'hsl(230, 100%, 65%)', label: 'Goals' },
    { radius: 78, progress: protocolScore, color: 'hsl(330, 100%, 60%)', label: 'Protocol' },
    { radius: 66, progress: bodyCoverage, color: 'hsl(45, 100%, 55%)', label: 'Coverage' },
  ];

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={viewBox} width={size} height={size}>
        {/* Background rings */}
        {rings.map((ring, i) => (
          <circle
            key={`bg-${i}`}
            cx="100"
            cy="100"
            r={ring.radius}
            fill="none"
            stroke="hsl(230 25% 20%)"
            strokeWidth={3}
            opacity={0.3}
          />
        ))}
        {/* Progress rings */}
        {rings.map((ring, i) => (
          <Ring key={`ring-${i}`} {...ring} />
        ))}
      </svg>
      {/* Center labels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold font-mono" style={{ color: 'hsl(230, 100%, 65%)' }}>
          {goalProgress}%
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Overall</span>
      </div>
      {/* Ring legends */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-3">
        {rings.map((ring, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ring.color, boxShadow: `0 0 6px ${ring.color}` }} />
            <span className="text-[9px] text-muted-foreground">{ring.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadialProgressRings;
