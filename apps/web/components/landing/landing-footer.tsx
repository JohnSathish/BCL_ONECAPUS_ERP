export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-white/45">
          © {new Date().getFullYear()} BaseCode Labs Pvt. Ltd. · BCL OneCampus ERP
        </p>
        <p className="text-xs text-white/35">A Product of BaseCode Labs · NEP 2020 · FYUGP Ready</p>
      </div>
    </footer>
  );
}
