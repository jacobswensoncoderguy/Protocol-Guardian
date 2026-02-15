import { useMemo } from 'react';

interface MiniSparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

const MiniSparkline = ({ values, width = 48, height = 16, className = '' }: MiniSparklineProps) => {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 1;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    const points = values.map((v, i) => ({
      x: padding + (i / (values.length - 1)) * usableW,
      y: padding + usableH - ((v - min) / range) * usableH,
    }));

    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [values, width, height]);

  if (values.length < 2) return null;

  const trending = values[values.length - 1] >= values[values.length - 2];

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spark-${values.length}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'} stopOpacity="0.4" />
          <stop offset="100%" stopColor={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#spark-${values.length})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {values.length >= 2 && (() => {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const lastX = 1 + ((values.length - 1) / (values.length - 1)) * (width - 2);
        const lastY = 1 + (height - 2) - ((values[values.length - 1] - min) / range) * (height - 2);
        return (
          <circle
            cx={lastX}
            cy={lastY}
            r="2"
            fill={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'}
          />
        );
      })()}
    </svg>
  );
};

export default MiniSparkline;
