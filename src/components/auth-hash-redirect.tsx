"use client";

import { useEffect } from "react";

export function AuthHashRedirect() {
  useEffect(() => {
    if (!window.location.hash) {
      return;
    }

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const recoveryType = params.get("type") === "recovery";

    if (!accessToken || !recoveryType || window.location.pathname === "/reset-password") {
      return;
    }

    window.location.replace(`/reset-password${window.location.hash}`);
  }, []);

  return null;
}
