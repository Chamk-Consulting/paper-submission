/** The submission wizard inside the workspace: full content width, and the side menu folds to icons for room. */
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span data-bleed data-focus-mode hidden />
      {children}
    </>
  );
}
