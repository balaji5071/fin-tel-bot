export const PERMISSIONS = {
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  MANAGE_BUDGETS: 'MANAGE_BUDGETS',
  VIEW_ALL_EXPENSES: 'VIEW_ALL_EXPENSES',
  EDIT_EXPENSE: 'EDIT_EXPENSE',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  MANAGE_CATEGORIES: 'MANAGE_CATEGORIES',
  VIEW_REPORTS: 'VIEW_REPORTS',
  VIEW_TEAM_REPORTS: 'VIEW_TEAM_REPORTS',
  VIEW_DEPARTMENT_REPORTS: 'VIEW_DEPARTMENT_REPORTS',
  ADD_EXPENSE: 'ADD_EXPENSE',
  VIEW_OWN_EXPENSES: 'VIEW_OWN_EXPENSES',
  UPLOAD_RECEIPT: 'UPLOAD_RECEIPT',
  MANAGE_VENDORS: 'MANAGE_VENDORS',
  MANAGE_RECURRING: 'MANAGE_RECURRING',
  MANAGE_CASH: 'MANAGE_CASH',
};

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: Object.values(PERMISSIONS),

  ADMIN: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_PERMISSIONS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_ALL_EXPENSES,
    PERMISSIONS.EDIT_EXPENSE,
    PERMISSIONS.DELETE_EXPENSE,
    PERMISSIONS.MANAGE_CATEGORIES,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_DEPARTMENT_REPORTS,
    PERMISSIONS.ADD_EXPENSE,
    PERMISSIONS.VIEW_OWN_EXPENSES,
    PERMISSIONS.UPLOAD_RECEIPT,
    PERMISSIONS.MANAGE_VENDORS,
    PERMISSIONS.MANAGE_BUDGETS,
    PERMISSIONS.MANAGE_RECURRING,
    PERMISSIONS.MANAGE_CASH,
  ],

  MANAGER: [
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_DEPARTMENT_REPORTS,
    PERMISSIONS.ADD_EXPENSE,
    PERMISSIONS.VIEW_OWN_EXPENSES,
    PERMISSIONS.UPLOAD_RECEIPT,
    PERMISSIONS.VIEW_REPORTS,
  ],

  EMPLOYEE: [
    PERMISSIONS.ADD_EXPENSE,
    PERMISSIONS.VIEW_OWN_EXPENSES,
    PERMISSIONS.UPLOAD_RECEIPT,
  ],
};

export class PermissionService {
  /**
   * Check if a user has a specific permission based on their role and custom permissions
   * @param {Object} user - User record from DB
   * @param {string} permission - Permission name from PERMISSIONS
   * @returns {boolean}
   */
  static hasPermission(user, permission) {
    if (!user) return false;

    // Super Admin has absolute override
    if (user.role === 'SUPER_ADMIN') return true;

    // Check standard role permissions
    const basePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (basePermissions.includes(permission)) {
      return true;
    }

    // Check user custom permissions (if any)
    if (user.customPermissions) {
      try {
        const custom = JSON.parse(user.customPermissions);
        if (Array.isArray(custom) && custom.includes(permission)) {
          return true;
        }
      } catch (e) {
        // Ignored
      }
    }

    return false;
  }
}
