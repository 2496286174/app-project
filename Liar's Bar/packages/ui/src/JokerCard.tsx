import React from 'react';

interface JokerCardProps {
  isVisible: boolean;
}

const JokerCard: React.FC<JokerCardProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="flex h-24 w-16 items-center justify-center rounded-[8px] border border-[var(--card-border)] bg-[var(--card-face)] text-2xl font-semibold text-[var(--card-joker-red)] shadow-sm">
      Joker
    </div>
  );
};

export default JokerCard;
