"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

interface Props {
  id: string;
  email: string;
  plan?: string;
}

export function IdentifyUser({ id, email, plan }: Props) {
  useEffect(() => {
    identify(id, { email, ...(plan ? { plan } : {}) });
  }, [id, email, plan]);
  return null;
}
