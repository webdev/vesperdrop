"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

export function IdentifyUser({ id, email }: { id: string; email: string }) {
  useEffect(() => {
    identify(id, { email });
  }, [id, email]);
  return null;
}
