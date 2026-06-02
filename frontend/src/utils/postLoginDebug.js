/** Ative no mobile: localStorage.setItem('DEBUG_POST_LOGIN', '1') e recarregue. */
export function isPostLoginDebugEnabled() {
  try {
    return (
      process.env.NODE_ENV !== "production" ||
      localStorage.getItem("DEBUG_POST_LOGIN") === "1"
    );
  } catch {
    return false;
  }
}

export function debugPostLogin(label, extra) {
  if (!isPostLoginDebugEnabled()) return;
  if (extra !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`[post-login] ${label}`, extra);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[post-login] ${label}`);
  }
}

export function countPostLogin(label) {
  if (!isPostLoginDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.count(`[post-login] ${label}`);
}
