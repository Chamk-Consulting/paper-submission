/** Organiser pages hold wide tables: the frame widens to 1600 px (see AppFrame). */
export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span data-wide-frame hidden />
      {children}
    </>
  );
}
