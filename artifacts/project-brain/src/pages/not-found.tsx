import { useLocation } from "wouter";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const history: any;

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 text-center">

      {/* Logo */}
      <a href="/" className="mb-10 flex items-center">
        <img
          src="/CodeMeGood_Logo.png"
          alt="CodeMeGood"
          className="h-7 w-auto object-contain"
          style={{ maxWidth: 140 }}
        />
      </a>

      {/* Big 404 */}
      <div className="w-16 h-16 rounded-2xl bg-elevated border border-panel flex items-center justify-center text-3xl mb-6">
        🧭
      </div>

      <h1 className="text-3xl font-bold text-heading mb-2">Page not found</h1>
      <p className="text-sm text-muted max-w-xs leading-relaxed mb-8">
        This page doesn't exist. You might have followed an old link or mistyped the address.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all"
        >
          ← Back to home
        </button>
        <button
          onClick={() => history.back()}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-panel bg-elevated text-subtle hover:text-body hover:border-primary/40 transition-all"
        >
          Go back
        </button>
      </div>

    </div>
  );
}
