export function formatWeddingDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00+08:00`));
}

export function Sprig({ className = '' }) {
  return (
    <svg className={`guest-sprig ${className}`.trim()} viewBox="0 0 80 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        d="M4 16c10-2 14-10 22-10 8 0 10 8 18 8 8 0 12-8 32-8"
      />
      <ellipse cx="18" cy="8" rx="4" ry="6" fill="currentColor" opacity="0.55" transform="rotate(-28 18 8)" />
      <ellipse cx="32" cy="14" rx="3.5" ry="5.5" fill="currentColor" opacity="0.45" transform="rotate(22 32 14)" />
      <ellipse cx="48" cy="8" rx="4" ry="6" fill="currentColor" opacity="0.5" transform="rotate(-18 48 8)" />
      <ellipse cx="64" cy="12" rx="3.2" ry="5" fill="currentColor" opacity="0.4" transform="rotate(16 64 12)" />
    </svg>
  );
}
