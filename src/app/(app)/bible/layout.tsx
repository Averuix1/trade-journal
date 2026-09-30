export default function BibleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {children}
      <footer className="mx-auto mt-8 max-w-[65ch] pb-2 text-center text-[11px] text-dim">
        World English Bible (public domain)
      </footer>
    </div>
  );
}
