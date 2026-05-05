import React from 'react';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

const Sparkline: React.FC<Props> = ({
  values,
  width = 80,
  height = 24,
  className = ''
}) => {
  if (values.length < 2) {
    return <span className="text-gray-500 text-xs">—</span>;
  }

  // Always normalize against the full 0-100 score range so two sparklines
  // are visually comparable rather than each auto-scaling to its own min/max.
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / 100) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = values[values.length - 1];
  const lastX = width;
  const lastY = height - (last / 100) * height;

  return (
    <svg
      width={width}
      height={height}
      className={`overflow-visible ${className}`}
      aria-label={`Performance trend: ${values.join(', ')}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
    </svg>
  );
};

export default Sparkline;
