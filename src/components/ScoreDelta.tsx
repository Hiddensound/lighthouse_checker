import React from 'react';

interface Props {
  current: number;
  previous?: number;
}

const ScoreDelta: React.FC<Props> = ({ current, previous }) => {
  if (previous === undefined || previous === null) {
    return <span className="text-gray-500 text-[10px]">—</span>;
  }

  const delta = current - previous;
  if (delta === 0) {
    return <span className="text-gray-400 text-[10px]" title="No change">·</span>;
  }

  const positive = delta > 0;
  const arrow = positive ? '↑' : '↓';
  const color = positive ? 'text-green-400' : 'text-red-400';

  return (
    <span
      className={`text-[10px] font-semibold ${color}`}
      title={`Was ${previous}, now ${current}`}
    >
      {arrow} {Math.abs(delta)}
    </span>
  );
};

export default ScoreDelta;
