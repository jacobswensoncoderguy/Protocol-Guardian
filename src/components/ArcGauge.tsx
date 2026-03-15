interface ArcGaugeProps {
  pct: number;
  size?: number;
  color: string;
  trackColor?: string;
  className?: string;
}

const ArcGauge = ({ pct, size = 34, color, trackColor, className = '' }: ArcGaugeProps) => {
  const strokeWidth = size >= 50 ? 4 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clampedPct / 100) * circumference;
  const fontSize = size >= 50 ? 11 : size >= 34 ? 8 : 7;

  return (
    <svg width={size} height={size} className={className} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor || 'var(--pg-card-border, rgba(255,255,255,0.07))'}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontFamily="'DM Mono', 'JetBrains Mono', monospace"
        fontWeight="bold"
      >
        {Math.round(clampedPct)}%
      </text>
    </svg>
  );
};

export default ArcGauge;
