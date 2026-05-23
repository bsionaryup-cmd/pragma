"use client";

import { useEffect } from "react";

const DEV_FOOTER_SELECTORS = [
  ".cl-footer",
  ".cl-footerPages",
  ".cl-footerAction",
  '[data-localization-key="developmentMode"]',
  '[class*="devMode"]',
  '[class*="DevMode"]',
];

/** Elimina el footer de desarrollo de Clerk (franja negra/naranja). */
export function ClerkAuthFooterCleanup() {
  useEffect(() => {
    function cleanup() {
      for (const selector of DEV_FOOTER_SELECTORS) {
        document.querySelectorAll(selector).forEach((node) => {
          node.remove();
        });
      }
    }

    cleanup();

    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
