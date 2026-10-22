/** Plan D3: after a failed submit, move focus to the first field marked invalid (screen readers then read its error). */
export function focusFirstError(root: ParentNode | null | undefined) {
  setTimeout(() => {
    const el = root?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-error]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el.matches("input, select, textarea, button")) el.focus({ preventScroll: true });
    else { el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); }
  }, 30);
}
