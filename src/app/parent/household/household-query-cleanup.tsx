"use client";

import { useEffect } from "react";

const transientParams = ["created", "invited", "saved"];

export function HouseholdQueryCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    for (const param of transientParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  return null;
}
