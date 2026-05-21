/** Apariencia Clerk alineada con PRAGMA (email + contraseña). */
export const pragmaClerkAppearance = {
  variables: {
    colorPrimary: "#0066FF",
    colorText: "#050A18",
    colorTextSecondary: "#6B7280",
    colorBackground: "transparent",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#050A18",
    borderRadius: "0.875rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 p-0 bg-transparent",
    cardBox: "shadow-none",
    headerTitle: "font-heading text-xl text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButton:
      "rounded-xl border border-border bg-card text-sm font-medium hover:bg-pragma-light-blue/50",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
    formFieldLabel: "text-sm font-medium text-foreground",
    formFieldInput:
      "rounded-xl border-border bg-card text-foreground focus:ring-2 focus:ring-pragma-cyan/40",
    formFieldInputShowPasswordButton:
      "text-pragma-electric hover:text-pragma-mid-blue",
    passwordFieldInput: "rounded-xl border-border",
    formButtonPrimary:
      "rounded-xl bg-pragma-electric hover:bg-pragma-electric/90 text-sm font-semibold shadow-pragma-soft",
    footerActionLink: "text-pragma-electric font-medium hover:text-pragma-mid-blue",
    footerActionText: "text-muted-foreground",
    identityPreviewEditButton: "text-pragma-electric",
    formResendCodeLink: "text-pragma-electric",
    alertText: "text-sm",
    otpCodeFieldInput: "rounded-xl border-border",
  },
} as const;
