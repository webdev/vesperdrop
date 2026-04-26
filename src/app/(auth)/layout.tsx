export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
