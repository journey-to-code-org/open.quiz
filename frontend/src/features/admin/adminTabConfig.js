export const ADMIN_TABS = [
  { id: "users", label: "Users", description: "Accounts, roles, and deletion requests" },
  { id: "lessons", label: "Lessons", description: "Modules, lessons, and avatars" },
  { id: "theming", label: "Theming", description: "Themes, packages, and site branding" },
];

export const DEFAULT_ADMIN_TAB = ADMIN_TABS[0].id;

export function getAdminTabFromHash(hash = "") {
  const id = hash.replace(/^#/, "");
  return ADMIN_TABS.some((tab) => tab.id === id) ? id : DEFAULT_ADMIN_TAB;
}
