const PATHS = {
  back: 'M15 5l-7 7 7 7',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  home: 'M3 11 12 4l9 7M5 10v10h14V10',
  play: 'M8 5v14l11-7z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1',
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  train: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  library: 'M4 4h5v16H4zM10 4h5v16h-5zM16 5l4 1-3 14-4-1z',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  close: 'M6 6l12 12M18 6 6 18',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  chevron: 'M9 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="square" strokeLinejoin="miter" aria-hidden className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
