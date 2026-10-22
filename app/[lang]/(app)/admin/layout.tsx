/** Platform admin inside the workspace: full content width. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span data-bleed hidden />
      {children}
    </>
  );
}
