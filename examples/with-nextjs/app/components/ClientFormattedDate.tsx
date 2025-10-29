"use client";

import dynamic from "next/dynamic";

export const FormattedDate = dynamic(
  () => import("./FormattedDate").then((m) => m.FormattedDate),
  { ssr: false },
);
