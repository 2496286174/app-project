export const buttonStyles = {
  primary: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-semibold text-[var(--paper)] shadow-[var(--shadow-pop)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  secondary: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--navy)] shadow-[var(--chip-shadow)] transition hover:bg-[var(--muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  success: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--surface-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] shadow-[var(--chip-shadow)] transition hover:bg-[var(--muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  danger: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-semibold text-[var(--paper)] shadow-[var(--shadow-pop)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  info: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--teal)] shadow-[var(--chip-shadow)] transition hover:bg-[var(--muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  purple: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-semibold text-[var(--paper)] shadow-[var(--shadow-pop)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
  gray: "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--navy)] transition hover:bg-[var(--muted)] active:scale-[0.98]"
};

export const cardStyles = {
  container: "w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--navy)] shadow-[var(--shadow-card)] backdrop-blur-2xl",
  title: "mb-3 text-base font-semibold text-[var(--navy)]",
  content: "mb-4",
  input: "min-h-11 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-base font-medium text-[var(--navy)] outline-none transition placeholder:text-[color:var(--text-soft)]/60 focus:border-[var(--cyan)] focus:ring-4 focus:ring-[var(--ring-cyan)]",
  label: "mb-1 block text-sm font-semibold text-[var(--navy)]"
};

export const layoutStyles = {
  container: "min-h-dvh bg-[var(--background)] px-0 text-[var(--navy)] md:p-5 [@media(orientation:landscape)]:p-5 [@media(orientation:landscape)_and_(max-height:500px)]:p-0",
  shell: "mx-auto flex min-h-dvh w-full max-w-[460px] flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--shadow-soft)] md:min-h-[calc(100dvh-40px)] md:w-[min(100vw-40px,1400px)] md:max-w-none md:rounded-[8px] md:border md:border-[var(--line)] [@media(orientation:landscape)]:min-h-[calc(100dvh-40px)] [@media(orientation:landscape)]:w-[min(100vw-40px,1400px)] [@media(orientation:landscape)]:max-w-none [@media(orientation:landscape)]:rounded-[8px] [@media(orientation:landscape)]:border [@media(orientation:landscape)]:border-[var(--line)] [@media(orientation:landscape)_and_(max-height:500px)]:min-h-dvh [@media(orientation:landscape)_and_(max-height:500px)]:w-full [@media(orientation:landscape)_and_(max-height:500px)]:max-w-none [@media(orientation:landscape)_and_(max-height:500px)]:rounded-none [@media(orientation:landscape)_and_(max-height:500px)]:border-0 [@media(orientation:landscape)_and_(max-height:500px)]:shadow-none",
  main: "flex min-h-0 flex-1 flex-col",
  content: "flex-1 overflow-y-auto bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-warm)_52%,var(--wash-fresh)_100%)] px-2 py-2 [@media(orientation:landscape)_and_(max-height:500px)]:px-1 [@media(orientation:landscape)_and_(max-height:500px)]:py-1",
  bottomDock: "sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface)] px-3 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 backdrop-blur-xl md:pb-[calc(env(safe-area-inset-bottom)+32px)]",
  section: "w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl",
  center: "flex flex-1 flex-col items-center justify-center"
};

export const textStyles = {
  bulletCount: "inline-flex min-h-8 items-center rounded-[8px] bg-[var(--surface-tint)] px-3 py-1.5 text-sm font-semibold text-[var(--teal)]",
  subtitle: "mb-4 text-sm text-[var(--text-soft)]"
};

export const modalStyles = {
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] px-4 py-4 backdrop-blur-md [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-2",
  container: "w-full max-w-md rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 text-[var(--navy)] shadow-[var(--shadow-soft)] [@media(orientation:landscape)]:max-w-[min(92vw,680px)] [@media(orientation:landscape)_and_(max-height:500px)]:p-4"
};
