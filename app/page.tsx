import { CertificateWorkspace } from "./certificate-workspace";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule bg-paper-raised">
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <a
              href="#workspace"
              className="font-serif text-lg font-bold tracking-tight text-ink"
            >
              certgen
            </a>
            <p className="text-sm text-ink-muted">
              Prepare a certificate. No account required.
            </p>
          </div>
        </div>
      </header>

      <main id="workspace" className="flex-1">
        <CertificateWorkspace />
      </main>
    </div>
  );
}
