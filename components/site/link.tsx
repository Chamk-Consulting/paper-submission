"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";

/**
 * Link that loads the next page when the person shows intent (hover, focus, touch) instead of fetching every
 * link on screen. A page full of links (workspace, lists) used to start ~75 background requests on arrival.
 * Pass `prefetch` to opt back into Next's default (e.g. the few main menu links): prefetch={null}.
 */
export default function Link({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  if (prefetch !== undefined) return <NextLink prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} {...props} />;
  const href = typeof props.href === "string" ? props.href : null;
  const warm = () => {
    if (href && href.startsWith("/") && !href.startsWith("//") && !/\.(pdf|ics)(\?|$)/.test(href)) router.prefetch(href);
  };
  return (
    <NextLink
      {...props}
      prefetch={false}
      onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => { warm(); onMouseEnter?.(e); }}
      onTouchStart={(e: TouchEvent<HTMLAnchorElement>) => { warm(); onTouchStart?.(e); }}
      onFocus={(e: FocusEvent<HTMLAnchorElement>) => { warm(); onFocus?.(e); }}
    />
  );
}
