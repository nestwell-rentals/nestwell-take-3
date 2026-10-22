import type { Access, FieldAccess } from 'payload'

export type Role = 'admin' | 'editor'

type MaybeUserWithRoles = { roles?: Role[] | null } | null | undefined

export const hasRole = (user: unknown, role: Role): boolean =>
  Boolean((user as MaybeUserWithRoles)?.roles?.includes(role))

/** Only admins: user management, seeding, settings. */
export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'admin')

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin')

/** Admins see everyone, other users only themselves. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (hasRole(user, 'admin')) return true

  return { id: { equals: user.id } }
}
