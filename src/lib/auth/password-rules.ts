/** Reglas básicas para contraseñas de nuevas cuentas. */
export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleDefinition = {
  id: string;
  label: string;
  test: (password: string) => boolean;
  message: string;
};

export const PASSWORD_RULE_DEFINITIONS: PasswordRuleDefinition[] = [
  {
    id: "length",
    label: "Mínimo 8 caracteres",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  },
  {
    id: "uppercase",
    label: "1 letra mayúscula",
    test: (password) => /[A-Z]/.test(password),
    message: "La contraseña debe incluir al menos una letra mayúscula.",
  },
  {
    id: "lowercase",
    label: "1 letra minúscula",
    test: (password) => /[a-z]/.test(password),
    message: "La contraseña debe incluir al menos una letra minúscula.",
  },
  {
    id: "number",
    label: "1 número",
    test: (password) => /\d/.test(password),
    message: "La contraseña debe incluir al menos un número.",
  },
  {
    id: "special",
    label: "1 carácter especial (ej. un punto)",
    test: (password) => /[^A-Za-z0-9]/.test(password),
    message: "La contraseña debe incluir al menos un carácter especial.",
  },
];

export function getPasswordRuleStatuses(password: string) {
  return PASSWORD_RULE_DEFINITIONS.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
}

export function isNewAccountPasswordValid(password: string): boolean {
  return PASSWORD_RULE_DEFINITIONS.every((rule) => rule.test(password));
}

export function validateNewAccountPassword(password: string): string | null {
  for (const rule of PASSWORD_RULE_DEFINITIONS) {
    if (!rule.test(password)) {
      return rule.message;
    }
  }

  return null;
}
