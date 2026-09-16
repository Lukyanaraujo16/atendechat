import { useEffect, useState } from "react";

/**
 * Object URL para preview de File/Blob, com revoke no cleanup.
 */
export default function useObjectUrl(blob) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!blob) {
      setUrl("");
      return undefined;
    }
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setUrl("");
      return undefined;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(next);
      }
    };
  }, [blob]);

  return url;
}
