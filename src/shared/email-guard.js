const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseProtectedEmailList(text) {
  const entries = [...new Set(String(text).split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
  const invalid = entries.filter((email) => !EMAIL_RE.test(email));
  return {
    emails: [...new Set(entries.filter((email) => EMAIL_RE.test(email)).map((email) => email.toLowerCase()))],
    invalid,
  };
}

export function containsProtectedEmail(values, protectedEmails) {
  const normalizedValues = values.map((value) => String(value ?? "").toLowerCase());
  return protectedEmails.some((email) => normalizedValues.some((value) => value.includes(email.toLowerCase())));
}
