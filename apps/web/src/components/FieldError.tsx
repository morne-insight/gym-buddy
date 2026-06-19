/** Renders the first validation message for a TanStack Form field, if any. */
export function FieldError({ errors }: { errors: Array<string | { message?: string } | undefined> }) {
  const first = errors.find(Boolean);
  if (!first) return null;
  const message = typeof first === 'string' ? first : (first.message ?? 'Invalid');
  return <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>;
}
