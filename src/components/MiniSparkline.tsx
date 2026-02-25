import { useMemo } from 'react';

interface MiniSparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Optional reference range low bound — renders a green band */
  refLow?: number;
  /** Optional reference range high bound — renders a green band */
  refHigh?: number;
}

const MiniSparkline = ({ values, width = 48, height = 16, className = '', refLow, refHigh }: MiniSparklineProps) => {
  const { path, bandY1, bandY2 } = useMemo(() => {
    if (values.length < 2) return { path: '', bandY1: 0, bandY2: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Expand domain to include ref range if provided
    const domainMin = refLow !== undefined ? Math.min(min, refLow) : min;
    const domainMax = refHigh !== undefined ? Math.max(max, refHigh) : max;
    const range = domainMax - domainMin || 1;

    const padding = 1;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    const toY = (v: number) => padding + usableH - ((v - domainMin) / range) * usableH;

    const points = values.map((v, i) => ({
      x: padding + (i / (values.length - 1)) * usableW,
      y: toY(v),
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Compute band y positions (clamped to svg bounds)
    const bY1 = refHigh !== undefined ? Math.max(padding, toY(refHigh)) : 0;
    const bY2 = refLow !== undefined ? Math.min(padding + usableH, toY(refLow)) : 0;

    return { path: linePath, bandY1: bY1, bandY2: bY2 };
  }, [values, width, height, refLow, refHigh]);

  if (values.length < 2) return null;

  const trending = values[values.length - 1] >= values[values.length - 2];
  const showBand = refLow !== undefined && refHigh !== undefined && bandY2 > bandY1;

  // Recompute last-point position with domain that includes ref range
  const domainMin = refLow !== undefined ? Math.min(Math.min(...values), refLow) : Math.min(...values);
  const domainMax = refHigh !== undefined ? Math.max(Math.max(...values), refHigh) : Math.max(...values);
  const domainRange = domainMax - domainMin || 1;
  const lastX = 1 + ((values.length - 1) / (values.length - 1)) * (width - 2);
  const lastY = 1 + (height - 2) - ((values[values.length - 1] - domainMin) / domainRange) * (height - 2);

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spark-${values.length}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'} stopOpacity="0.4" />
          <stop offset="100%" stopColor={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'} stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Reference range green band */}
      {showBand && (
        <rect
          x="0"
          y={bandY1}
          width={width}
          height={bandY2 - bandY1}
          fill="hsl(142, 70%, 50%)"
          opacity="0.10"
          rx="1"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={`url(#spark-${values.length})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r="2"
        fill={trending ? 'hsl(160, 100%, 45%)' : 'hsl(330, 100%, 60%)'}
      />
    </svg>
  );
};

export default MiniSparkline;