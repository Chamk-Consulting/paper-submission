"use client";

import { useEffect } from "react";

/**
 * React 19 resets a <form action={…}> after every server action, success or not. When the action
 * comes back with an error, that wipes what the person typed. This cancels the automatic reset
 * whenever the form is showing an error (an element with data-form-error, role="alert" or
 * aria-invalid="true"), so the typed values stay for a correction. Successful submits reset as usual.
 */
export function KeepFormValues() {
  useEffect(() => {
    const onReset = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || form.hasAttribute("data-allow-reset")) return;
      if (form.querySelector('[data-form-error], [role="alert"], [aria-invalid="true"]')) e.preventDefault();
    };
    document.addEventListener("reset", onReset, true);
    return () => document.removeEventListener("reset", onReset, true);
  }, []);
  return null;
}
