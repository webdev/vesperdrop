export const ADMIN_EMAILS = ["gblazer@gmail.com", "info@slavablazer.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
