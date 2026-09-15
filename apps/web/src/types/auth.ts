export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string | null;
};

export type MePayload = {
  user: AuthUser;
  permissionCodes: string[];
};

export type AuthPersist = {
  sessionToken: string | null;
  accessToken: string | null;
  user: AuthUser | null;
  permissionCodes: string[];
};
