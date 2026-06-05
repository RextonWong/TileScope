"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={{ "--normal-bg": "#171717", "--normal-border": "#262626", "--normal-text": "#e5e5e5" } as React.CSSProperties}
      {...props}
    />
  );
}
