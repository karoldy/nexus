export function isAdminRole(role: string | null | undefined) {
  return role === 'admin';
}

export function hasPermission(codes: string[], code: string, role?: string | null) {
  return isAdminRole(role) || codes.includes(code);
}
