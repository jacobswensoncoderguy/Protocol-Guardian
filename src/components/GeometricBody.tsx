import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';
import bodyMale from '@/assets/body-male.jpeg';
import bodyFemale from '@/assets/body-female.jpeg';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

type Gender = 'male' | 'female';

// Each zone: { top, left, width, height } in %, plus a borderRadius for organic shape
interface ZoneRegion {
  top: number; left: number; width: number; height: number;
  borderRadius: string;
}

const ZONE_REGIONS: Record<Gender, Record<BodyZone, ZoneRegion[]>> = {
  male: {
    brain: [
      { top: 1, left: 32, width: 36, height: 14, borderRadius: '50% 50% 40% 40%' },
    ],
    immune: [
      { top: 15, left: 34, width: 32, height: 5, borderRadius: '30%' },
    ],
    heart: [
      { top: 20, left: 26, width: 48, height: 14, borderRadius: '40% 40% 50% 50%' },
    ],
    arms: [
      { top: 20, left: 6, width: 18, height: 22, borderRadius: '40% 30% 50% 40%' },
      { top: 20, left: 76, width: 18, height: 22, borderRadius: '30% 40% 40% 50%' },
    ],
    core: [
      { top: 34, left: 28, width: 44, height: 14, borderRadius: '20% 20% 30% 30%' },
    ],
    hormonal: [
      { top: 48, left: 30, width: 40, height: 8, borderRadius: '30% 30% 40% 40%' },
    ],
    legs: [
      { top: 56, left: 20, width: 24, height: 38, borderRadius: '30% 30% 20% 40%' },
      { top: 56, left: 56, width: 24, height: 38, borderRadius: '30% 30% 40% 20%' },
    ],
  },
  female: {
    brain: [
      { top: 2, left: 33, width: 34, height: 14, borderRadius: '50% 50% 40% 40%' },
    ],
    immune: [
      { top: 16, left: 36, width: 28, height: 5, borderRadius: '30%' },
    ],
    heart: [
      { top: 21, left: 28, width: 44, height: 12, borderRadius: '40% 40% 50% 50%' },
    ],
    arms: [
      { top: 21, left: 10, width: 16, height: 18, borderRadius: '40% 30% 50% 40%' },
      { top: 21, left: 74, width: 16, height: 18, borderRadius: '30% 40% 40% 50%' },
    ],
    core: [
      { top: 33, left: 30, width: 40, height: 12, borderRadius: '20% 20% 30% 30%' },
    ],
    hormonal: [
      { top: 45, left: 32, width: 36, height: 7, borderRadius: '30% 30% 40% 40%' },
    ],
    legs: [
      { top: 52, left: 22, width: 22, height: 40, borderRadius: '30% 30% 20% 40%' },
      { top: 52, left: 56, width: 22, height: 40, borderRadius: '30% 30% 40% 20%' },
    ],
  },
};

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);
  const [gender, setGender] = useState<Gender>('male');
  const [pulsingZone, setPulsingZone] = useState<BodyZone | null>(null);

  const bodyImage = gender === 'male' ? bodyMale : bodyFemale;
  const regions = ZONE_REGIONS[gender];

  const handleZoneTap = (zone: BodyZone) => {
    setPulsingZone(zone);
    setTimeout(() => setPulsingZone(null), 800);
    onZoneTap?.(zone);
  };

  const renderHitArea = (zone: BodyZone, region: ZoneRegion, idx: number) => {
    const info = BODY_ZONES[zone];
    const isHovered = hoveredZone === zone;
    const isPulsing = pulsingZone === zone;
    const intensity = zoneIntensities[zone];
    const isActive = intensity > 0.1;

    // Subtle idle glow for active zones, brighter on hover, pulse on tap
    const borderColor = isPulsing || isHovered
      ? info.color
      : isActive
        ? `${info.color}`
        : 'transparent';

    const borderOpacity = isPulsing ? 1 : isHovered ? 0.8 : isActive ? 0.15 + intensity * 0.2 : 0;

    return (
      <div
        key={`${zone}-${idx}`}
        className="absolute cursor-pointer"
        style={{
          top: `${region.top}%`,
          left: `${region.left}%`,
          width: `${region.width}%`,
          height: `${region.height}%`,
          borderRadius: region.borderRadius,
          border: `1.5px solid ${borderColor}`,
          borderColor: borderColor,
          opacity: borderOpacity > 0 ? 1 : 1, // always present for click
          boxShadow: isPulsing
            ? `0 0 24px ${info.color}90, 0 0 48px ${info.color}40, inset 0 0 16px ${info.color}25`
            : isHovered
              ? `0 0 18px ${info.color}60, inset 0 0 10px ${info.color}15`
              : isActive
                ? `0 0 8px ${info.color}${Math.round(intensity * 30).toString(16).padStart(2, '0')}`
                : 'none',
          backgroundColor: isHovered
            ? `${info.color}0A`
            : 'transparent',
          transition: 'all 0.3s ease',
          animation: isPulsing ? 'zonePulseGlow 0.8s ease-out' : undefined,
          // Make the border itself transparent when inactive
          ...((!isHovered && !isPulsing && !isActive) && { borderColor: 'transparent' }),
          ...((isActive && !isHovered && !isPulsing) && {
            borderColor: info.color,
            borderWidth: '1px',
            opacity: borderOpacity,
          }),
          ...((isHovered || isPulsing) && {
            borderColor: info.color,
            borderWidth: isPulsing ? '2px' : '1.5px',
          }),
        }}
        onClick={() => handleZoneTap(zone)}
        onPointerEnter={() => setHoveredZone(zone)}
        onPointerLeave={() => setHoveredZone(null)}
      />
    );
  };

  return (
    <div className={`w-full h-full flex flex-col items-center ${className}`}>
      {/* Gender toggle */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setGender('male')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'male'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Male
        </button>
        <button
          onClick={() => setGender('female')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'female'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Female
        </button>
      </div>

      {/* Body figure floating on dark bg */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative max-w-[220px] w-full">
          {/* The cartoon figure — screen blend makes black bg transparent */}
          <img
            src={bodyImage}
            alt={`${gender} body map`}
            className="relative w-full h-auto object-contain transition-opacity duration-500"
            style={{
              mixBlendMode: 'screen',
              filter: 'drop-shadow(3px 5px 10px hsl(0 0% 0% / 0.7))',
            }}
            draggable={false}
          />

          {/* Organic-shaped zone hit areas */}
          {(Object.entries(regions) as Array<[BodyZone, ZoneRegion[]]>).map(([zone, regs]) =>
            regs.map((reg, idx) => renderHitArea(zone as BodyZone, reg, idx))
          )}

          {/* Hover tooltip */}
          {hoveredZone && (() => {
            const info = BODY_ZONES[hoveredZone];
            const intensity = zoneIntensities[hoveredZone];
            const firstRegion = regions[hoveredZone][0];
            const tooltipTop = firstRegion.top > 12 ? firstRegion.top - 7 : firstRegion.top + firstRegion.height + 1;

            return (
              <div
                className="absolute z-20 pointer-events-none left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-center"
                style={{
                  top: `${tooltipTop}%`,
                  backgroundColor: 'hsl(var(--card) / 0.95)',
                  border: `1px solid ${info.color}60`,
                  boxShadow: `0 0 16px ${info.color}30, 0 4px 12px hsl(0 0% 0% / 0.4)`,
                }}
              >
                <span className="text-[11px] font-semibold font-mono block" style={{ color: info.color }}>
                  {info.label}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {Math.round(intensity * 100)}% coverage
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`
        @keyframes zonePulseGlow {
          0% { transform: scale(1.03); opacity: 1; }
          50% { transform: scale(1.01); opacity: 0.7; }
          100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default GeometricBody;
