import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Resets the window scroll to the top on every route change. Without this,
// react-router preserves the previous scroll offset, so navigating from a
// scrolled list (e.g. mattress cards) into a detail page would open it
// part-way down instead of at the top.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
