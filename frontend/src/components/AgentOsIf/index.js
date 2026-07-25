import React from "react";

/** Renderiza children apenas se `when` for verdadeiro. */
export default function AgentOsIf({ when, children, fallback = null }) {
  if (!when) return fallback;
  return children;
}
