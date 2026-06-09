/* Inline stroke icons — no icon dependency. 24x24, currentColor. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const HomeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
)

export const PaymentIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M2.5 9.5h19" />
    <path d="M6 15.5h4" />
  </svg>
)

export const AttendanceIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="3" />
    <path d="M3 9h18M8 3v3M16 3v3" />
    <path d="m9 14 2 2 4-4" />
  </svg>
)

export const ProfileIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
  </svg>
)

export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
)

export const MegaphoneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5l-9 5H4a1 1 0 0 0-1 1Z" />
    <path d="M18 8a4 4 0 0 1 0 8" />
  </svg>
)

export const FingerprintIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 11a2.5 2.5 0 0 1 2.5 2.5c0 2-.5 4-1.2 5.5" />
    <path d="M7 19c1-1.7 1.5-3.7 1.5-5.5A3.5 3.5 0 0 1 12 10a3.5 3.5 0 0 1 3.5 3.5c0 1-.1 2-.3 3" />
    <path d="M4.5 16c.7-1 1-2.3 1-3.5a6.5 6.5 0 0 1 11-4.7" />
    <path d="M19.5 13.5c.1-.6.1-1.2.1-1.5" />
  </svg>
)

export const WhatsAppIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.7 1.7c.1.1.1.3 0 .5l-.3.5c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.7.9.8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.3.1.4.2.5.3.1.2.1.7-.1 1.4Z" />
  </svg>
)
