const PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  sales: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.2 4H2V2h4.6l.9 2H21l-3.6 8H8.1l-.9 2H19v2H4l2.4-4.6z',
  quotations: 'M6 2h9l5 5v15H4V2h2zm8 1.5V8h4.5zM7 12h10v1.6H7zm0 4h10v1.6H7zm0-8h5v1.6H7z',
  invoices: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zm3 5v1.6h8V7zm0 4v1.6h8V11zm0 4v1.6h5V15z',
  inventory: 'M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.3 6.3 3.1L12 10.6 5.7 7.4zM5 9.1l6 3v7.4l-6-3zm8 10.4v-7.4l6-3v7.4z',
  payments: 'M2 5h20v14H2zm2 4h16V7H4zm0 3v5h16v-5zm2 2h5v1.6H6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm17.5-5.8c2.6.5 4.5 2.4 4.5 4.8v1h-4v-1c0-1.8-.2-3.4-.5-4.8z',
  activity: 'M3 12h4l3-8 4 16 3-8h4v2h-2.6L14 22 10 6l-1.6 6H3z',
  account: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-9 10c0-4.4 4-8 9-8s9 3.6 9 8z',
  upload: 'M11 16V7.8L8.4 10.4 7 9l5-5 5 5-1.4 1.4L13 7.8V16zm-7 2h16v2H4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  alert: 'M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z',
  signout: 'M10 3H4v18h6v-2H6V5h4zm6.6 4.4L15.2 8.8 17.4 11H9v2h8.4l-2.2 2.2 1.4 1.4L21.2 12z',
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? ''} fill="currentColor" />
    </svg>
  );
}
