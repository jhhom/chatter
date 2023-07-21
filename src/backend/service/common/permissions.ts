class Permission {
  private permission: string;

  constructor(permission: string) {
    this.permission = permission;
  }

  canJoin() {
    return this.permission.includes("J") || this.isOwner();
  }

  canRead() {
    return this.permission.includes("R") || this.isOwner();
  }

  canWrite() {
    return this.permission.includes("W") || this.isOwner();
  }

  canShare() {
    return this.permission.includes("S") || this.isOwner();
  }

  canDelete() {
    return this.permission.includes("D") || this.isOwner();
  }

  canAdminister() {
    return this.permission.includes("A") || this.isOwner();
  }

  canGetNotifiedOfPresence() {
    return this.permission.includes("P") || this.isOwner();
  }

  isOwner() {
    return this.permission.includes("O");
  }
}

export function permission(permission: string) {
  return new Permission(permission);
}

export function groupAdminPermission() {
  return "JRWSDAPO";
}
