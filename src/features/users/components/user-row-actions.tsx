"use client";

import dynamic from "next/dynamic";
import type { AppUserRole } from "@/types/auth";

const EditUserDialog = dynamic(
  () =>
    import("@/features/users/components/edit-user-dialog").then((m) => ({
      default: m.EditUserDialog,
    })),
);

const DeleteUserButton = dynamic(
  () =>
    import("@/features/users/components/delete-user-button").then((m) => ({
      default: m.DeleteUserButton,
    })),
);

const UserActiveToggle = dynamic(
  () =>
    import("@/features/users/components/user-active-toggle").then((m) => ({
      default: m.UserActiveToggle,
    })),
);

const UserRoleSelect = dynamic(
  () =>
    import("@/features/users/components/user-role-select").then((m) => ({
      default: m.UserRoleSelect,
    })),
);

const CreateUserDialog = dynamic(
  () =>
    import("@/features/users/components/create-user-dialog").then((m) => ({
      default: m.CreateUserDialog,
    })),
);

type UserRoleSelectFieldProps = {
  userId: string;
  role: AppUserRole;
  disabled: boolean;
};

export function UserRoleSelectField({
  userId,
  role,
  disabled,
}: UserRoleSelectFieldProps) {
  return (
    <UserRoleSelect userId={userId} currentRole={role} disabled={disabled} />
  );
}

type UserTableActionsProps = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  ownerLockedForOthers: boolean;
  canWrite: boolean;
  canDeleteThisUser: boolean;
  isSelf: boolean;
  isAccountOwner: boolean;
};

export function UserTableActions({
  userId,
  email,
  firstName,
  lastName,
  isActive,
  ownerLockedForOthers,
  canWrite,
  canDeleteThisUser,
  isSelf,
  isAccountOwner,
}: UserTableActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canWrite ? (
        <EditUserDialog
          userId={userId}
          email={email}
          firstName={firstName}
          lastName={lastName}
          disabled={!isActive || ownerLockedForOthers}
        />
      ) : null}
      {canWrite ? (
        <UserActiveToggle
          userId={userId}
          isActive={isActive}
          disabled={isSelf || isAccountOwner}
        />
      ) : null}
      {canDeleteThisUser ? (
        <DeleteUserButton userId={userId} email={email} />
      ) : null}
    </div>
  );
}

export function CreateUserDialogButton() {
  return <CreateUserDialog />;
}
