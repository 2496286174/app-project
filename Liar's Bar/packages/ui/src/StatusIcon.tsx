import React from 'react';

export type StatusIconType = 'bullet' | 'card';

export interface StatusIconProps {
  type: StatusIconType;
  className?: string;
}

interface BaseStatusIconProps {
  className?: string;
}

export function BulletStatusIcon({ className = 'h-3.5 w-3.5 shrink-0' }: BaseStatusIconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 1024 1024" fill="none">
      <path
        d="M562.333538 310.665846a43.716923 43.716923 0 0 0-59.746461-1.181538l-301.528615 276.440615a39.424 39.424 0 0 0-1.181539 57.265231l190.070154 190.227692a39.345231 39.345231 0 0 0 57.225846-1.339077l276.558769-301.528615a43.598769 43.598769 0 0 0-1.260307-59.707077l-160.137847-160.177231zM149.385846 663.236923a41.550769 41.550769 0 0 0-58.564923 0 41.550769 41.550769 0 0 0 0 58.525539l222.641231 222.601846a41.432615 41.432615 0 0 0 58.525538-58.564923L149.385846 663.236923zM879.143385 118.350769c-63.015385-1.851077-195.465846 8.073846-281.796923 109.331693-1.457231 2.953846-15.596308 31.586462 6.222769 53.563076l150.173538 151.000616c5.710769 5.435077 24.339692 19.298462 53.326769 2.953846 40.093538-38.4 109.686154-127.606154 108.819693-282.269538-0.787692-28.750769-26.190769-33.831385-36.745846-34.579693z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CardStatusIcon({ className = 'h-3.5 w-3.5 shrink-0' }: BaseStatusIconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <rect x="7" y="3.5" width="10.5" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 6.5v11.2a2.8 2.8 0 0 0 2.8 2.8h7.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M11.1 9.1h2.3M11.1 12h2.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function SmallStatusIcon({ type, className = 'h-3.5 w-3.5 shrink-0' }: StatusIconProps) {
  return type === 'bullet'
    ? <BulletStatusIcon className={className} />
    : <CardStatusIcon className={className} />;
}

export default SmallStatusIcon;
