// Thin line icons drawn to match the 1.25px stroke of the brand's menu
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export const PhoneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6.6 3.5 9 3.9l1.2 3.6-1.9 1.4a12 12 0 0 0 6.8 6.8l1.4-1.9 3.6 1.2.4 2.4c.1.9-.6 1.7-1.5 1.7C10.6 19.1 4.9 13.4 4.9 5c0-.9.8-1.6 1.7-1.5Z" />
    <path d="M14.5 3.5a6 6 0 0 1 6 6M14.5 6.5a3 3 0 0 1 3 3" />
  </svg>
);

export const MailIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="0.5" />
    <path d="m3.5 6 8.5 7 8.5-7M3.5 18l6.5-6M20.5 18 14 12" />
  </svg>
);

export const MapIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 5.5 3.5 7.5v12L9 17.5l6 2 5.5-2v-5" />
    <path d="M9 5.5v12M15 12.5v7" />
    <path d="M17.5 2.5a3 3 0 0 1 3 3c0 2.2-3 5-3 5s-3-2.8-3-5a3 3 0 0 1 3-3Z" />
    <circle cx="17.5" cy="5.5" r="0.9" />
  </svg>
);

export const ClockIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const SlidersIcon = (p) => (
  <svg {...base} width={20} height={20} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="1.8" fill="#fff" />
    <circle cx="15" cy="12" r="1.8" fill="#fff" />
    <circle cx="8" cy="18" r="1.8" fill="#fff" />
  </svg>
);

export const InstagramIcon = (p) => (
  <svg {...base} width={26} height={26} strokeWidth={1.6} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
  </svg>
);

export const ThreadsIcon = (p) => (
  <svg {...base} width={26} height={26} strokeWidth={1.6} {...p}>
    <path d="M16.5 11.2c-.3-2.6-2-3.9-4.4-3.9-2 0-3.4 1-4 2.5" />
    <path d="M16.6 12.3c-1.1-.9-2.6-1.2-4.3-1.1-2.3.2-3.6 1.3-3.5 2.8.1 1.4 1.5 2.2 3.1 2.1 2.6-.2 3.8-2.1 3.8-5.4" />
    <path d="M18.8 7.4C17.5 4.9 15.1 3.5 12 3.5 7 3.5 4 6.9 4 12s3 8.5 8 8.5c3.4 0 6-1.8 6.7-4.6.5-2.1-.3-3.7-2.1-4.6" />
  </svg>
);
