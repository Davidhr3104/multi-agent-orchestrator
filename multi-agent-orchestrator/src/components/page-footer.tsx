export function PageFooter() {
  return (
    <footer className="border-outline-variant/20 bg-surface-dim mt-8 w-full border-t py-4">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
        <p className="text-on-surface-variant font-label-sm text-[12px]">
          Helix Orchestrator v2.4.0
        </p>
        <div className="flex gap-4">
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            Documentation
          </span>
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            Support
          </span>
          <span className="text-on-surface-variant hover:text-tertiary cursor-default text-[13px] underline">
            System Status
          </span>
        </div>
      </div>
    </footer>
  );
}
