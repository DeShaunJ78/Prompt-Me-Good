export default function ComplexityWarning({ appMeta, warning }) {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-elevated border border-panel">
        <span className="text-2xl">{appMeta.icon}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Classified as
          </p>
          <p className="text-sm font-semibold text-heading">{appMeta.label}</p>
        </div>
      </div>

      <div className="px-4 py-4 rounded-xl flex gap-3 bg-secondary/8 border border-secondary/25">
        <div className="shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-secondary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold mb-1 text-secondary">Hidden Complexity Warning</p>
          <p className="text-sm leading-relaxed text-body">{warning}</p>
        </div>
      </div>
    </div>
  );
}
