import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import {
  approveDeleteAccount,
  createAdminLesson,
  createAdminModule,
  deleteAdminLesson,
  deleteAdminModule,
  getAdminAvatarAssets,
  getAdminModules,
  getAdminUsers,
  getPendingDeleteAccount,
  hardDeleteAdminUser,
  importAdminLessonModule,
  rejectDeleteAccount,
  resetAdminUserProgress,
  seedAdminRandomUsers,
  setAdminUserDisabled,
  setAdminUserDeleted,
  updateAdminModule,
  updateAdminLesson,
  updateAdminUserRole,
  uploadAdminAvatar,
  verifyAdminUserEmail,
} from "../services/api";
import Card from "../shared/Card/Card.component";
import Button from "../shared/Button/Button.component";
import PackageManager from "../features/admin/packages/PackageManager";

const emptyModule = { id: "", title: "", lessons: [] };
const lessonModuleTemplate = {
  id: "getting-started",
  title: "Getting started",
  lessons: [
    {
      id: "1.1",
      title: "Your first lesson",
      learningGoal: "Describe what the learner will understand.",
      estimatedMin: 5,
      passingScore: 70,
      accuracy_reviewed_by: "Reviewer name",
      accuracy_reviewed_at: "2026-10-01",
      microLessons: [
        {
          id: "1.1.1",
          title: "A short step",
          microLessonContent: [
            { type: "paragraph", text: "Introduce one idea in clear language." },
            {
              type: "knowledgeCheck",
              id: "1.1.1-q1",
              questionType: "multipleChoice",
              question: "Which answer matches the lesson?",
              answerChoices: [
                { key: "a", text: "Correct answer" },
                { key: "b", text: "Another answer" },
              ],
              correctResponse: "a",
              explanation: "Explain why the answer is correct.",
            },
          ],
        },
      ],
    },
  ],
  characters: [
    {
      characterId: "guide",
      name: "Guide",
      imagePath: "/api/v1/assets/replace-with-uploaded-avatar-id",
    },
  ],
  glossary: [{ term: "Example term", definition: "Add a concise definition." }],
  worksCited: [],
};
const lessonBlockTypes = [
  "paragraph",
  "characterIntro",
  "formula",
  "callout",
  "unorderedList",
  "knowledgeCheck",
  "table",
];
const getUserId = (user) => String(user?.id || user?._id || "");

export default function AdminDashboardPage() {
  const { csrfToken, user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [modules, setModules] = useState([]);
  const [avatarAssets, setAvatarAssets] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [moduleForm, setModuleForm] = useState(emptyModule);
  const [lessonTitle, setLessonTitle] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lessonJson, setLessonJson] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const actionInFlightRef = useRef(false);
  const [state, setState] = useState({ isLoading: true, error: "", message: "" });

  const loadData = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const [userPayload, modulePayload, deletionPayload, avatarPayload] = await Promise.all([
        getAdminUsers(),
        getAdminModules(),
        getPendingDeleteAccount(),
        getAdminAvatarAssets(),
      ]);
      setUsers(userPayload.users ?? []);
      setPendingDeletions(deletionPayload.users ?? []);
      setModules(modulePayload.modules ?? []);
      setAvatarAssets(avatarPayload.assets ?? []);
      setSelectedModuleId((current) => current || modulePayload.modules?.[0]?.id || "");
      setState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setState({ isLoading: false, error: error.message, message: "" });
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedModule = modules.find((module) => module.id === selectedModuleId);

  const refreshUsers = useCallback(async () => {
    const userPayload = await getAdminUsers();
    setUsers(userPayload.users ?? []);
  }, []);

  const refreshModules = useCallback(async () => {
    const modulePayload = await getAdminModules();
    const nextModules = modulePayload.modules ?? [];
    setModules(nextModules);
    setSelectedModuleId((current) =>
      nextModules.some((module) => module.id === current) ? current : (nextModules[0]?.id ?? ""),
    );
  }, []);

  const refreshAvatarAssets = useCallback(async () => {
    const payload = await getAdminAvatarAssets();
    setAvatarAssets(payload.assets ?? []);
  }, []);

  function updateUserInList(updatedUser) {
    const updatedUserId = getUserId(updatedUser);
    if (!updatedUserId) return;
    setUsers((current) =>
      current.map((user) =>
        getUserId(user) === updatedUserId ? { ...user, ...updatedUser } : user,
      ),
    );
    if (updatedUser.is_deleted) {
      setPendingDeletions((current) => current.filter((user) => getUserId(user) !== updatedUserId));
    }
  }

  function removeUserFromList(userId) {
    const targetUserId = String(userId);
    setUsers((current) => current.filter((user) => getUserId(user) !== targetUserId));
    setPendingDeletions((current) => current.filter((user) => getUserId(user) !== targetUserId));
  }

  async function runAction(action, successMessage, { applyResult, refresh = false } = {}) {
    // The ref blocks repeat clicks that land before the disabled state renders.
    if (actionInFlightRef.current) return null;
    actionInFlightRef.current = true;
    setIsRunningAction(true);
    try {
      const result = await action();
      await applyResult?.(result);
      setState((current) => ({ ...current, isLoading: false, error: "", message: successMessage }));
      if (refresh) await loadData();
      return result;
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
      return null;
    } finally {
      actionInFlightRef.current = false;
      setIsRunningAction(false);
    }
  }

  async function runPendingDeletionAction(action, userId, actionName, successMessage) {
    setPendingAction({ userId, actionName });
    try {
      const result = await action(userId, csrfToken);
      setPendingDeletions((current) =>
        current.filter((user) => getUserId(user) !== String(userId)),
      );
      if (result?.user) updateUserInList(result.user);
      setState((current) => ({ ...current, isLoading: false, error: "", message: successMessage }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setPendingAction(null);
    }
  }

  function handleModuleSelect(module) {
    setSelectedModuleId(module.id);
    setModuleForm({ id: module.id, title: module.title, lessons: module.lessons ?? [] });
    setSelectedLessonId(module.lessons?.[0]?.id || "");
    setLessonJson(module.lessons?.[0] ? JSON.stringify(module.lessons[0], null, 2) : "");
  }

  function handleLessonSelect(lesson) {
    setSelectedLessonId(lesson.id);
    setLessonJson(JSON.stringify(lesson, null, 2));
  }

  function parseLessonJson() {
    try {
      return JSON.parse(lessonJson);
    } catch {
      throw new Error("Lesson JSON is invalid. Check commas, quotes, and brackets.");
    }
  }

  function getLessonDraft() {
    try {
      return JSON.parse(lessonJson);
    } catch {
      return null;
    }
  }

  function updateLessonDraft(updater) {
    try {
      const draft = updater(parseLessonJson());
      setLessonJson(JSON.stringify(draft, null, 2));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  }

  function updateLessonField(field, value) {
    updateLessonDraft((lesson) => ({ ...lesson, [field]: value }));
  }

  function updateMicroLesson(microLessonId, field, value) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) =>
        microLesson.id === microLessonId ? { ...microLesson, [field]: value } : microLesson,
      ),
    }));
  }

  function updateBlock(microLessonId, blockIndex, value) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) => {
        if (microLesson.id !== microLessonId) return microLesson;
        const content = [...(microLesson.microLessonContent ?? [])];
        content[blockIndex] = { ...content[blockIndex], text: value };
        return { ...microLesson, microLessonContent: content };
      }),
    }));
  }

  function updateBlockType(microLessonId, blockIndex, type) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) => {
        if (microLesson.id !== microLessonId) return microLesson;
        const content = [...(microLesson.microLessonContent ?? [])];
        const currentBlock = content[blockIndex] ?? {};
        const nextBlock = { ...currentBlock, type };
        if (type === "paragraph" || type === "callout" || type === "formula") {
          nextBlock.text = currentBlock.text ?? "Write content here.";
        }
        if (type === "unorderedList" && !Array.isArray(nextBlock.items)) {
          nextBlock.items = ["Add a list item"];
        }
        content[blockIndex] = nextBlock;
        return { ...microLesson, microLessonContent: content };
      }),
    }));
  }

  function updateBlockField(microLessonId, blockIndex, field, value) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) => {
        if (microLesson.id !== microLessonId) return microLesson;
        const content = [...(microLesson.microLessonContent ?? [])];
        content[blockIndex] = { ...content[blockIndex], [field]: value };
        return { ...microLesson, microLessonContent: content };
      }),
    }));
  }

  function updateListItem(microLessonId, blockIndex, itemIndex, value) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) => {
        if (microLesson.id !== microLessonId) return microLesson;
        const content = [...(microLesson.microLessonContent ?? [])];
        const items = [...(content[blockIndex].items ?? [])];
        items[itemIndex] = value;
        content[blockIndex] = { ...content[blockIndex], items };
        return { ...microLesson, microLessonContent: content };
      }),
    }));
  }

  function updateChoice(microLessonId, blockIndex, choiceIndex, field, value) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).map((microLesson) => {
        if (microLesson.id !== microLessonId) return microLesson;
        const content = [...(microLesson.microLessonContent ?? [])];
        const choices = [...(content[blockIndex].answerChoices ?? [])];
        choices[choiceIndex] = { ...choices[choiceIndex], [field]: value };
        content[blockIndex] = { ...content[blockIndex], answerChoices: choices };
        return { ...microLesson, microLessonContent: content };
      }),
    }));
  }

  function addMicroLesson() {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: [
        ...(lesson.microLessons ?? []),
        {
          id: `${lesson.id}-micro-${Date.now()}`,
          title: "New micro-lesson",
          microLessonContent: [{ type: "paragraph", text: "Write lesson content here." }],
        },
      ],
    }));
  }

  function removeMicroLesson(microLessonId) {
    updateLessonDraft((lesson) => ({
      ...lesson,
      microLessons: (lesson.microLessons ?? []).filter(
        (microLesson) => microLesson.id !== microLessonId,
      ),
    }));
  }

  const lessonDraft = getLessonDraft();

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-small font-semibold uppercase tracking-wide text-primary">Admin</p>
        <h1 className="font-heading text-h1 font-bold text-heading">Control center</h1>
        <p className="max-w-2xl text-foreground">Manage users and lesson content.</p>
      </header>

      <PackageManager csrfToken={csrfToken} modules={modules} />

      {state.error ? (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-success">
          {state.message}
        </p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-5 py-4">
          <h2 className="font-heading text-h3 font-bold text-heading">Pending deletions</h2>
          <span className="text-sm text-foreground">{pendingDeletions.length} pending</span>
        </div>
        {state.isLoading ? <p className="p-5 text-foreground">Loading...</p> : null}
        {!state.isLoading && pendingDeletions.length === 0 ? (
          <p className="p-5 text-foreground">No deletion requests are awaiting review.</p>
        ) : null}
        {!state.isLoading && pendingDeletions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-primary/5 text-heading">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeletions.map((user) => {
                  const userId = user._id || user.id;
                  const isApproving =
                    pendingAction?.userId === userId && pendingAction.actionName === "approve";
                  const isRejecting =
                    pendingAction?.userId === userId && pendingAction.actionName === "reject";
                  return (
                    <tr key={userId} className="border-t border-primary/10">
                      <td className="px-5 py-4 font-medium text-heading">{user.name}</td>
                      <td className="px-5 py-4 text-foreground">{user.email}</td>
                      <td className="px-5 py-4 text-foreground">
                        {user.deletion_requested_at
                          ? new Date(user.deletion_requested_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-8 px-2 py-1 text-xs text-danger underline"
                            disabled={Boolean(pendingAction)}
                            loading={isApproving}
                            onClick={() =>
                              void runPendingDeletionAction(
                                approveDeleteAccount,
                                userId,
                                "approve",
                                "Deletion scheduled.",
                              )
                            }
                          >
                            Approve deletion
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-8 px-2 py-1 text-xs underline"
                            disabled={Boolean(pendingAction)}
                            loading={isRejecting}
                            onClick={() =>
                              void runPendingDeletionAction(
                                rejectDeleteAccount,
                                userId,
                                "reject",
                                "Deletion rejected.",
                              )
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-5 py-4">
          <h2 className="font-heading text-h3 font-bold text-heading">Users</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              loading={isRunningAction}
              onClick={() =>
                void runAction(() => seedAdminRandomUsers(csrfToken), "10 random users seeded.", {
                  applyResult: refreshUsers,
                  refresh: false,
                })
              }
            >
              Seed 10 users
            </Button>
            <span className="text-sm text-foreground">{users.length} loaded</span>
          </div>
        </div>
        {state.isLoading ? <p className="p-5 text-foreground">Loading...</p> : null}
        {!state.isLoading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-primary/5 text-heading">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((adminUser) => (
                  <tr key={adminUser.id} className="border-t border-primary/10">
                    <td className="px-5 py-4 font-medium text-heading">{adminUser.name}</td>
                    <td className="px-5 py-4 text-foreground">{adminUser.email}</td>
                    <td className="px-5 py-4 capitalize text-foreground">{adminUser.role}</td>
                    <td className="px-5 py-4 text-foreground">
                      {adminUser.deleted_at
                        ? `Deletion scheduled${adminUser.deletion_scheduled_at ? ` (${new Date(adminUser.deletion_scheduled_at).toLocaleDateString()})` : ""}`
                        : adminUser.is_disabled
                          ? "Banned"
                          : "Active"}
                    </td>
                    <td className="flex flex-wrap gap-2 px-5 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-8 px-2 py-1 text-xs underline"
                        disabled={
                          isRunningAction ||
                          adminUser.id === currentUser?.id ||
                          Boolean(adminUser.is_deleted || adminUser.deleted_at)
                        }
                        onClick={() =>
                          void runAction(
                            () => resetAdminUserProgress({ userId: adminUser.id, csrfToken }),
                            "Progress reset.",
                            { refresh: false },
                          )
                        }
                      >
                        Reset progress
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-8 px-2 py-1 text-xs underline"
                        disabled={
                          isRunningAction ||
                          adminUser.id === currentUser?.id ||
                          Boolean(adminUser.is_deleted || adminUser.deleted_at)
                        }
                        onClick={() =>
                          void runAction(
                            () =>
                              setAdminUserDisabled({
                                userId: adminUser.id,
                                disabled: !adminUser.is_disabled,
                                csrfToken,
                              }),
                            "User status updated.",
                            { applyResult: updateUserInList, refresh: false },
                          )
                        }
                      >
                        {adminUser.is_disabled ? "Unban" : "Ban"}
                      </Button>
                      {!adminUser.email_verified_at ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2 py-1 text-xs underline"
                          disabled={
                            isRunningAction ||
                            adminUser.id === currentUser?.id ||
                            Boolean(adminUser.is_deleted || adminUser.deleted_at)
                          }
                          onClick={() =>
                            void runAction(
                              () => verifyAdminUserEmail({ userId: adminUser.id, csrfToken }),
                              "Email verified.",
                              { applyResult: updateUserInList, refresh: false },
                            )
                          }
                        >
                          Verify email
                        </Button>
                      ) : null}
                      {adminUser.id !== currentUser?.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2 py-1 text-xs underline"
                          onClick={() =>
                            void runAction(
                              () =>
                                updateAdminUserRole({
                                  userId: adminUser.id,
                                  role: adminUser.role === "admin" ? "learner" : "admin",
                                  csrfToken,
                                }),
                              "User role updated.",
                              { applyResult: updateUserInList, refresh: false },
                            )
                          }
                          disabled={
                            isRunningAction || Boolean(adminUser.is_deleted || adminUser.deleted_at)
                          }
                        >
                          {adminUser.role === "admin" ? "Demote" : "Promote"}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-8 px-2 py-1 text-xs underline"
                        disabled={isRunningAction || adminUser.id === currentUser?.id}
                        onClick={() =>
                          void runAction(
                            () =>
                              setAdminUserDeleted({
                                userId: adminUser.id,
                                deleted: !adminUser.deleted_at,
                                csrfToken,
                              }),
                            adminUser.deleted_at ? "User restored." : "Deletion scheduled.",
                            { applyResult: updateUserInList, refresh: false },
                          )
                        }
                      >
                        {adminUser.deleted_at ? "Restore" : "Schedule deletion"}
                      </Button>
                      {adminUser.deleted_at ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2 py-1 text-xs text-danger underline"
                          disabled={isRunningAction || adminUser.id === currentUser?.id}
                          onClick={() => {
                            if (window.confirm(`Permanently delete ${adminUser.email}?`)) {
                              void runAction(
                                () =>
                                  hardDeleteAdminUser({
                                    userId: adminUser.id,
                                    email: adminUser.email,
                                    csrfToken,
                                  }),
                                "User permanently deleted.",
                                {
                                  applyResult: () => removeUserFromList(adminUser.id),
                                  refresh: false,
                                },
                              );
                            }
                          }}
                        >
                          Permanently delete
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-heading text-h3 font-bold text-heading">Avatar library</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Upload PNG, JPEG, or WebP avatars, then use their URLs in each module's `characters`
            array.
          </p>
        </div>
        <label className="inline-flex w-fit cursor-pointer items-center rounded-md border border-primary px-4 py-2 font-semibold text-primary">
          Upload avatar
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isRunningAction}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void runAction(() => uploadAdminAvatar({ file, csrfToken }), "Avatar uploaded.", {
                  applyResult: refreshAvatarAssets,
                  refresh: false,
                });
              }
              event.target.value = "";
            }}
          />
        </label>
        {avatarAssets.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {avatarAssets.map((asset) => (
              <li key={asset.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
                <img
                  src={asset.url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full border border-neutral-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">{asset.name}</p>
                  {asset.sourcePackageId ? (
                    <p className="truncate text-xs text-neutral-600">
                      From package {asset.sourcePackageId}
                    </p>
                  ) : null}
                  <code className="block truncate text-xs text-neutral-600">{asset.url}</code>
                  <Button
                    variant="ghost"
                    className="mt-1 min-h-8 px-2 py-1 text-xs underline"
                    onClick={() => void navigator.clipboard.writeText(asset.url)}
                  >
                    Copy avatar URL
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600">No avatars uploaded yet.</p>
        )}
      </Card>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-h3 font-bold text-heading">Lesson modules</h2>
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-md border border-primary px-4 py-2 font-semibold text-primary">
              Upload JSON
              <input
                className="sr-only"
                type="file"
                accept=".json,application/json"
                disabled={isRunningAction}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file)
                    void runAction(
                      () => importAdminLessonModule({ file, csrfToken }),
                      "Lesson module imported.",
                      { applyResult: refreshModules, refresh: false },
                    );
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <details className="rounded-lg border border-primary/15 bg-surface-inset p-4">
          <summary className="cursor-pointer font-semibold text-heading">
            Lesson JSON schema and example
          </summary>
          <p className="my-3 text-sm text-neutral-700">
            Import a module JSON with `id`, `title`, and `lessons`. Each lesson contains
            `microLessons`; each step uses `microLessonContent` blocks. Uploaded avatar URLs go in
            `characters[].imagePath`, and the matching `characterId` can be used in lesson blocks.
          </p>
          <pre className="max-h-96 overflow-auto rounded-md bg-surface-app p-3 text-xs text-foreground">
            {JSON.stringify(lessonModuleTemplate, null, 2)}
          </pre>
        </details>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="space-y-2">
            {modules.map((module) => (
              <Button
                variant={module.id === selectedModuleId ? "primary" : "secondary"}
                key={module.id}
                className="w-full justify-start text-left"
                onClick={() => handleModuleSelect(module)}
              >
                {module.title}{" "}
                <span className="text-sm text-foreground">({module.lessonCount})</span>
              </Button>
            ))}
            <Button
              variant="secondary"
              className="w-full border-dashed text-primary"
              onClick={() => {
                setSelectedModuleId("");
                setModuleForm(emptyModule);
              }}
            >
              New module
            </Button>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-md border border-primary/20 px-3 py-2"
                placeholder="Module ID"
                value={moduleForm.id}
                disabled={Boolean(selectedModule)}
                onChange={(event) => setModuleForm({ ...moduleForm, id: event.target.value })}
              />
              <input
                className="rounded-md border border-primary/20 px-3 py-2"
                placeholder="Module title"
                value={moduleForm.title}
                onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                loading={isRunningAction}
                onClick={() =>
                  void runAction(
                    () =>
                      selectedModule
                        ? updateAdminModule({
                            moduleId: selectedModule.id,
                            updates: { title: moduleForm.title },
                            csrfToken,
                          })
                        : createAdminModule({ module: moduleForm, csrfToken }),
                    selectedModule ? "Module updated." : "Module created.",
                    { applyResult: refreshModules, refresh: false },
                  )
                }
              >
                {selectedModule ? "Save module" : "Create module"}
              </Button>
              {selectedModule ? (
                <Button
                  variant="ghost"
                  className="border border-danger text-danger"
                  disabled={isRunningAction}
                  onClick={() => {
                    if (window.confirm("Delete this module?"))
                      void runAction(
                        () => deleteAdminModule({ moduleId: selectedModule.id, csrfToken }),
                        "Module deleted.",
                        { applyResult: refreshModules, refresh: false },
                      );
                  }}
                >
                  Delete module
                </Button>
              ) : null}
            </div>
            {selectedModule ? (
              <div className="space-y-3 border-t border-primary/10 pt-4">
                <h3 className="font-heading text-xl font-bold text-heading">Lessons</h3>
                <div className="flex gap-3">
                  <input
                    className="rounded-md border border-primary/20 px-3 py-2"
                    placeholder="New lesson title"
                    value={lessonTitle}
                    onChange={(event) => setLessonTitle(event.target.value)}
                  />
                  <Button
                    variant="primary"
                    loading={isRunningAction}
                    onClick={() => {
                      const id = `${selectedModule.id}-lesson-${Date.now()}`;
                      void runAction(
                        () =>
                          createAdminLesson({
                            moduleId: selectedModule.id,
                            lesson: { id, title: lessonTitle, microLessons: [] },
                            csrfToken,
                          }),
                        "Lesson created.",
                        { applyResult: refreshModules, refresh: false },
                      );
                      setLessonTitle("");
                    }}
                  >
                    Add lesson
                  </Button>
                </div>
                {(selectedModule.lessons ?? []).map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`flex items-center justify-between border-b border-primary/10 py-2 ${lesson.id === selectedLessonId ? "font-semibold text-primary" : ""}`}
                  >
                    <Button
                      variant="ghost"
                      className="justify-start px-2"
                      onClick={() => handleLessonSelect(lesson)}
                    >
                      {lesson.title || lesson.id}
                    </Button>
                    <div className="flex gap-2">
                      <span className="text-xs text-foreground">
                        {lesson.microLessons?.length ?? 0} micro-lessons
                      </span>
                      <Button
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs text-danger underline"
                        disabled={isRunningAction}
                        onClick={() => {
                          if (window.confirm("Delete this lesson?"))
                            void runAction(
                              () =>
                                deleteAdminLesson({
                                  moduleId: selectedModule.id,
                                  lessonId: lesson.id,
                                  csrfToken,
                                }),
                              "Lesson deleted.",
                              { applyResult: refreshModules, refresh: false },
                            );
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedLessonId ? (
                  <div className="space-y-3 border-t border-primary/10 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-heading text-lg font-bold text-heading">
                          Lesson content editor
                        </h4>
                        <p className="text-sm text-foreground">
                          Edit lesson metadata, micro-lessons, quizzes, and content blocks.
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        loading={isRunningAction}
                        onClick={() => {
                          try {
                            const lesson = parseLessonJson();
                            void runAction(
                              () =>
                                updateAdminLesson({
                                  moduleId: selectedModule.id,
                                  lessonId: selectedLessonId,
                                  lesson,
                                  csrfToken,
                                }),
                              "Lesson content saved.",
                              { applyResult: refreshModules, refresh: false },
                            );
                          } catch (error) {
                            setState((current) => ({ ...current, error: error.message }));
                          }
                        }}
                      >
                        Save content
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm font-semibold text-heading">
                        Lesson title
                        <input
                          className="w-full rounded-md border border-primary/20 px-3 py-2 font-normal"
                          value={lessonDraft?.title ?? ""}
                          onChange={(event) => updateLessonField("title", event.target.value)}
                        />
                      </label>
                      <label className="space-y-1 text-sm font-semibold text-heading">
                        Learning goal
                        <input
                          className="w-full rounded-md border border-primary/20 px-3 py-2 font-normal"
                          value={lessonDraft?.learningGoal ?? ""}
                          onChange={(event) =>
                            updateLessonField("learningGoal", event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="space-y-3 rounded-xl border border-primary/10 bg-surface-inset p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="font-heading text-lg font-bold text-heading">
                          Micro-lessons
                        </h5>
                        <Button variant="secondary" onClick={addMicroLesson}>
                          Add micro-lesson
                        </Button>
                      </div>
                      {(lessonDraft?.microLessons ?? []).map((microLesson) => (
                        <div
                          key={microLesson.id}
                          className="space-y-3 rounded-lg border border-primary/10 bg-surface-raised p-3"
                        >
                          <div className="flex items-end gap-2">
                            <label className="flex-1 space-y-1 text-sm font-semibold text-heading">
                              Title
                              <input
                                className="w-full rounded-md border border-primary/20 px-3 py-2 font-normal"
                                value={microLesson.title ?? ""}
                                onChange={(event) =>
                                  updateMicroLesson(microLesson.id, "title", event.target.value)
                                }
                              />
                            </label>
                            <Button
                              variant="ghost"
                              className="text-danger"
                              onClick={() => removeMicroLesson(microLesson.id)}
                            >
                              Remove
                            </Button>
                          </div>
                          {(microLesson.microLessonContent ?? []).map((block, blockIndex) => (
                            <div
                              key={block.id ?? `${microLesson.id}-${block.type}`}
                              className="space-y-2 rounded-md border border-primary/10 bg-surface-inset p-3"
                            >
                              <label className="space-y-1 text-sm font-semibold text-heading">
                                Block type
                                <select
                                  className="w-full rounded-md border border-primary/20 bg-surface-input px-3 py-2 font-normal"
                                  value={
                                    lessonBlockTypes.includes(block.type) ? block.type : "paragraph"
                                  }
                                  onChange={(event) =>
                                    updateBlockType(microLesson.id, blockIndex, event.target.value)
                                  }
                                >
                                  {lessonBlockTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {block.type === "paragraph" ||
                              block.type === "callout" ||
                              block.type === "formula" ? (
                                <label className="space-y-1 text-sm text-heading">
                                  <span className="font-semibold">Text</span>
                                  <textarea
                                    className="min-h-20 w-full rounded-md border border-primary/20 px-3 py-2"
                                    value={block.text ?? ""}
                                    onChange={(event) =>
                                      updateBlock(microLesson.id, blockIndex, event.target.value)
                                    }
                                  />
                                </label>
                              ) : block.type === "characterIntro" ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="space-y-1 text-sm text-heading">
                                    Character ID
                                    <input
                                      className="w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={block.characterId ?? ""}
                                      onChange={(event) =>
                                        updateBlockField(
                                          microLesson.id,
                                          blockIndex,
                                          "characterId",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1 text-sm text-heading">
                                    Intro text
                                    <textarea
                                      className="min-h-20 w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={block.text ?? ""}
                                      onChange={(event) =>
                                        updateBlock(microLesson.id, blockIndex, event.target.value)
                                      }
                                    />
                                  </label>
                                </div>
                              ) : block.type === "unorderedList" ? (
                                <div className="space-y-2">
                                  {(block.items ?? []).map((item, itemIndex) => (
                                    <input
                                      key={item}
                                      className="w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={item}
                                      onChange={(event) =>
                                        updateListItem(
                                          microLesson.id,
                                          blockIndex,
                                          itemIndex,
                                          event.target.value,
                                        )
                                      }
                                    />
                                  ))}
                                  <Button
                                    variant="secondary"
                                    onClick={() =>
                                      updateBlockField(microLesson.id, blockIndex, "items", [
                                        ...(block.items ?? []),
                                        "New list item",
                                      ])
                                    }
                                  >
                                    Add list item
                                  </Button>
                                </div>
                              ) : block.type === "knowledgeCheck" ? (
                                <div className="space-y-2">
                                  <label className="space-y-1 text-sm text-heading">
                                    Question
                                    <textarea
                                      className="min-h-20 w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={block.question ?? ""}
                                      onChange={(event) =>
                                        updateBlockField(
                                          microLesson.id,
                                          blockIndex,
                                          "question",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  {(block.answerChoices ?? []).map((choice, choiceIndex) => (
                                    <div
                                      key={choice.key}
                                      className="grid gap-2 sm:grid-cols-[5rem_1fr]"
                                    >
                                      <input
                                        className="rounded-md border border-primary/20 px-3 py-2"
                                        value={choice.key ?? ""}
                                        onChange={(event) =>
                                          updateChoice(
                                            microLesson.id,
                                            blockIndex,
                                            choiceIndex,
                                            "key",
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <input
                                        className="rounded-md border border-primary/20 px-3 py-2"
                                        value={choice.text ?? ""}
                                        onChange={(event) =>
                                          updateChoice(
                                            microLesson.id,
                                            blockIndex,
                                            choiceIndex,
                                            "text",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  ))}
                                  <label className="space-y-1 text-sm text-heading">
                                    Correct choice IDs
                                    <input
                                      className="w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={
                                        Array.isArray(block.correctResponse)
                                          ? block.correctResponse.join(", ")
                                          : (block.correctResponse ?? "")
                                      }
                                      onChange={(event) =>
                                        updateBlockField(
                                          microLesson.id,
                                          blockIndex,
                                          "correctResponse",
                                          event.target.value
                                            .split(",")
                                            .map((item) => item.trim())
                                            .filter(Boolean),
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1 text-sm text-heading">
                                    Explanation
                                    <textarea
                                      className="min-h-20 w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={block.explanation ?? ""}
                                      onChange={(event) =>
                                        updateBlockField(
                                          microLesson.id,
                                          blockIndex,
                                          "explanation",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              ) : block.type === "table" ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="space-y-1 text-sm text-heading">
                                    Table ID
                                    <input
                                      className="w-full rounded-md border border-primary/20 px-3 py-2"
                                      value={block.tableId ?? ""}
                                      onChange={(event) =>
                                        updateBlockField(
                                          microLesson.id,
                                          blockIndex,
                                          "tableId",
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <p className="text-xs text-foreground">
                                    Edit table headers and reference IDs in the advanced JSON
                                    editor.
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-foreground">
                                  This block has type-specific fields. Use the advanced JSON editor
                                  below to edit them.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <textarea
                      className="min-h-[28rem] w-full rounded-md border border-primary/20 bg-surface-input p-4 font-mono text-sm text-heading"
                      value={lessonJson}
                      onChange={(event) => setLessonJson(event.target.value)}
                      spellCheck="false"
                      aria-label="Lesson JSON content"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-foreground">Choose a module or create one to manage lessons.</p>
            )}
          </div>
        </div>
      </Card>
    </main>
  );
}
