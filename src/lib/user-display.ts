export function firstNameFrom(user: {
  user_metadata?: {
    full_name?: string;
    name?: string;
    given_name?: string;
  };
  email?: string | null;
}): string | null {
  const meta = user.user_metadata ?? {};
  const candidate =
    meta.given_name ??
    meta.full_name?.split(" ")[0] ??
    meta.name?.split(" ")[0] ??
    user.email?.split("@")[0];
  if (!candidate) return null;
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}
