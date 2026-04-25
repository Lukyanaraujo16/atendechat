export const isElevatedProfile = (profile: string): boolean =>
  profile === "admin" || profile === "supervisor";
