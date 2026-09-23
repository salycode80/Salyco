/** Quiet surface behind forms and specifications, per Design.md v2. */
export default function PageBackground() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-warm-white" />;
}
