import React, { useId } from 'react';

/**
 * Chamfered Golden HUD Section Header Bar matching `《 核保`, `《 契约`, `《 智能服务`, `《 线上化`, `《 机构排行TOP5`, `《 线上化-官微`
 */
export const HudSectionHeader: React.FC<{
  title: string;
  rightTag?: string;
  className?: string;
}> = ({ title, rightTag, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `hud-bar-grad-${uid}`;
  const lineId = `hud-bar-line-${uid}`;

  return (
    <div
      className={`relative flex items-center justify-between h-8 pr-6 pl-3 select-none ${className}`}
    >
      {/* Full-Height Geometric Double-Chevron Golden Frame & Gradient Fill */}
      <svg
        viewBox="0 0 360 32"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#c47e20" stopOpacity="0.48" />
            <stop offset="48%" stopColor="#75460d" stopOpacity="0.22" />
            <stop offset="88%" stopColor="#261604" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={lineId} x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ffd782" stopOpacity="0.95" />
            <stop offset="58%" stopColor="#c68225" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#7a4c10" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Background Polygon Fill inside the Chevron Bar */}
        <polygon
          points="342,2 352,16 342,30 0,30 0,2"
          fill={`url(#${gradId})`}
        />

        {/* Outer Full-Height Golden Chevron + Top & Bottom Horizontal Lines */}
        <polyline
          points="12,2 343,2 353,16 343,30 4,30"
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth="1.3"
        />

        {/* Bright Outer Chevron Highlight on the Right Leading Edge */}
        <polyline
          points="349,2 359,16 349,30"
          fill="none"
          stroke="#ffe5a3"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Parallel Full-Height Chevron Highlight */}
        <polyline
          points="342,2 352,16 342,30"
          fill="none"
          stroke="#f5b851"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glowing Bottom Golden Accent Segment */}
        <line
          x1="255"
          y1="30"
          x2="335"
          y2="30"
          stroke="#ffd884"
          strokeWidth="2"
        />
      </svg>

      {/* Section Title */}
      <h3 className="relative z-10 text-[13px] sm:text-sm font-bold text-[#f7e7c4] tracking-wide whitespace-nowrap">
        {title}
      </h3>

      {rightTag && (
        <span className="relative z-10 text-[11px] text-[#d6ba87] font-mono-tabular whitespace-nowrap">
          {rightTag}
        </span>
      )}
    </div>
  );
};

/**
 * 3D Isometric Golden Hexagon Icon Badge matching Section 1 (`核保`)
 */
export const GoldenHexIcon: React.FC<{ type: 'bars' | 'clock' }> = ({ type }) => {
  const uid = useId().replace(/:/g, '');
  const outerId = `hex-outer-${uid}`;
  const innerId = `hex-inner-${uid}`;

  return (
    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 56 56" className="w-12 h-12 overflow-visible">
        <defs>
          <linearGradient id={outerId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe7aa" />
            <stop offset="50%" stopColor="#d18824" />
            <stop offset="100%" stopColor="#613905" />
          </linearGradient>
          <radialGradient id={innerId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#52330c" />
            <stop offset="100%" stopColor="#170e03" />
          </radialGradient>
        </defs>
        <polygon
          points="28,3 50,15.5 50,40.5 28,53 6,40.5 6,15.5"
          fill={`url(#${innerId})`}
          stroke={`url(#${outerId})`}
          strokeWidth="2.4"
        />
        <polygon
          points="28,7.5 46,18 46,38 28,48.5 10,38 10,18"
          fill="none"
          stroke="#ffda85"
          strokeWidth="0.8"
          strokeOpacity="0.55"
        />
        {type === 'bars' ? (
          <g>
            <rect x="17" y="29" width="3.8" height="9" fill="#d99432" />
            <rect x="23" y="25" width="3.8" height="13" fill="#eeb050" />
            <rect x="29" y="20" width="3.8" height="18" fill="#ffd27d" />
            <rect x="35" y="16" width="3.8" height="22" fill="#fff2cf" />
            <path
              d="M16 26 Q25 22 37 13"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g>
            <circle
              cx="28"
              cy="29.5"
              r="10.5"
              fill="rgba(235, 168, 68, 0.18)"
              stroke="#ffd884"
              strokeWidth="2"
            />
            <line x1="24.5" y1="15" x2="31.5" y2="15" stroke="#fff0c7" strokeWidth="2.2" />
            <line x1="28" y1="15" x2="28" y2="18.5" stroke="#fff0c7" strokeWidth="2" />
            <polyline
              points="28,23.5 28,29.5 33,31.5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

/**
 * 5-Block Segmented Golden Progress Indicator matching Section 2 (`契约`)
 */
export const GoldenSegmentedBar: React.FC<{
  label: string;
  percentage: number;
}> = ({ label, percentage }) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const totalBlocks = 5;
  const filledBlocks = (clamped / 100) * totalBlocks;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-[#d2c7b8] font-medium truncate" title={label}>
        {label}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1" dir="ltr">
          <span className="w-[3px] h-2.5 bg-[#e5a039] rounded-l-xs inline-block mr-0.5 opacity-80" />
          {Array.from({ length: totalBlocks }).map((_, idx) => {
            const fillRatio = Math.max(0, Math.min(1, filledBlocks - idx));
            return (
              <div
                key={idx}
                className="w-3.5 sm:w-4 h-2.5 bg-[#23190d] overflow-hidden relative"
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.round(fillRatio * 100)}%`,
                    background:
                      'linear-gradient(180deg, #ffdfa0 0%, #e5a240 55%, #b87318 100%)',
                    boxShadow: fillRatio > 0 ? '0 0 6px rgba(245, 184, 81, 0.55)' : 'none'
                  }}
                />
              </div>
            );
          })}
        </div>
        <span className="font-mono-tabular text-sm sm:text-[15px] font-bold text-[#ffffff]">
          {clamped.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

/**
 * Dual-Segment Golden Donut Ring matching Section 3 (`智能服务`)
 */
export const GoldenDonutGauge: React.FC<{
  label: string;
  percentage: number;
}> = ({ label, percentage }) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const mainArcLength = (clamped / 100) * (circumference * 0.86);
  const secondaryArcLength = circumference * 0.1;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 56 56" className="w-14 h-14">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="#1f160c"
            strokeWidth="9.5"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="#e8a856"
            strokeWidth="9.5"
            strokeDasharray={`${mainArcLength} ${circumference}`}
            transform="rotate(-55 28 28)"
            className="transition-all duration-300"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="#fae2b4"
            strokeWidth="9.5"
            strokeDasharray={`${secondaryArcLength} ${circumference}`}
            transform="rotate(-108 28 28)"
          />
        </svg>
      </div>

      <div className="min-w-0">
        <div className="text-xs text-[#d2c7b8] leading-snug truncate" title={label}>
          {label}
        </div>
        <div className="font-mono-tabular text-xl sm:text-[22px] font-bold text-[#ffffff] leading-tight mt-1">
          {clamped.toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

export interface BarChartDatum {
  id: string;
  label: string;
  value: number;
  isGold: boolean;
}

/**
 * 6-Column Metallic Silver & Glowing Gold Vertical Bar Chart matching Section 4 (`线上化`)
 */
export const GoldenBarChart: React.FC<{
  seriesName: string;
  unitLabel: string;
  data: BarChartDatum[];
  maxValue?: number;
  onSelectBar?: (id: string) => void;
}> = ({ seriesName, unitLabel, data, maxValue, onSelectBar }) => {
  const highestDataVal = data.reduce((acc, d) => Math.max(acc, d.value), 0);
  const maxVal =
    maxValue ??
    (highestDataVal <= 40
      ? 40
      : highestDataVal <= 100
        ? 100
        : highestDataVal <= 200
          ? 200
          : Math.ceil(highestDataVal / 50) * 50);

  const yTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0
  ];

  return (
    <div className="w-full pt-1 select-none">
      <div className="relative flex items-center justify-center text-[11px] text-[#b8b0a4] mb-1.5">
        <span className="absolute right-0 text-[10px] text-[#8e857a]">{unitLabel}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1.5 bg-[#d6933a] inline-block" />
          <span className="text-[11px] text-[#d2c7b8]">{seriesName}</span>
        </div>
      </div>

      <div className="relative h-40 flex items-end pr-7 pl-1 pb-5">
        <div className="absolute inset-0 pr-7 pl-1 pb-5 flex flex-col justify-between pointer-events-none">
          {yTicks.map((tick) => (
            <div
              key={tick}
              className="relative w-full border-b border-[#ffffff]/12 h-0"
            >
              <span className="absolute -right-7 -top-2 text-[10px] text-[#9b9286] font-mono-tabular w-6 text-left">
                {tick}
              </span>
            </div>
          ))}
        </div>

        <div className="relative z-10 w-full h-full flex items-end justify-around gap-2.5 pt-3">
          {data.map((item) => {
            const clampedVal = Math.min(maxVal, Math.max(maxVal * 0.08, item.value));
            const heightPct = (clampedVal / maxVal) * 100;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBar?.(item.id)}
                className="group flex-1 h-full flex flex-col items-center justify-end cursor-pointer focus:outline-none"
              >
                <span className="font-mono-tabular text-[11px] font-semibold text-[#f3ece0] mb-1 group-hover:text-[#ffd584]">
                  {item.value}
                </span>

                <div
                  className="w-full max-w-[28px] transition-all duration-300 relative"
                  style={{
                    height: `${heightPct}%`,
                    background: item.isGold
                      ? 'linear-gradient(180deg, rgba(242, 173, 68, 0.96) 0%, rgba(188, 114, 22, 0.68) 55%, rgba(65, 36, 5, 0.22) 100%)'
                      : 'linear-gradient(180deg, rgba(196, 196, 196, 0.88) 0%, rgba(122, 122, 122, 0.55) 55%, rgba(42, 42, 42, 0.18) 100%)',
                    borderTop: item.isGold ? '2px solid #ffe9b3' : '2px solid #ffffff',
                    boxShadow: item.isGold
                      ? '0 -2px 10px rgba(245, 180, 75, 0.45)'
                      : '0 -1px 6px rgba(255, 255, 255, 0.22)'
                  }}
                />

                <span className="absolute -bottom-5 text-[10px] text-[#9b9286] group-hover:text-[#ffe2a8] whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
