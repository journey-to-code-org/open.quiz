const { useTestDb } = require("./setup");
const User = require("../src/models/User.model.js");
const {
  findOrCreateOAuthUser,
  selectProviderAvatar,
  selectVerifiedEmail,
} = require("../src/services/oauthUser.service.js");

useTestDb();

const verifiedEmail = (value, primary = true) => [{ value, verified: true, primary }];

const createLocalUser = (overrides = {}) =>
  User.create({
    name: "Existing Learner",
    email: "existing@example.com",
    password_hash: "not-a-real-hash",
    role: "learner",
    tos_agreement: true,
    email_verified_at: new Date(),
    ...overrides,
  });

describe("OAuth user service", () => {
  it("allows multiple non-OAuth users without sparse provider index collisions", async () => {
    await User.init();

    const users = await User.create([
      {
        name: "First Local User",
        email: "first-local@example.com",
        password_hash: "not-a-real-hash",
        tos_agreement: true,
      },
      {
        name: "Second Local User",
        email: "second-local@example.com",
        password_hash: "not-a-real-hash",
        tos_agreement: true,
      },
    ]);

    expect(users).toHaveLength(2);
    expect(
      users.every((user) => user.google_id === undefined && user.github_id === undefined),
    ).toBe(true);
  });

  it("prefers a primary verified email and otherwise selects another verified email", () => {
    expect(
      selectVerifiedEmail([
        { value: "secondary@example.com", verified: true, primary: false },
        { value: "primary@example.com", verified: true, primary: true },
      ]),
    ).toBe("primary@example.com");
    expect(
      selectVerifiedEmail([
        { value: "unverified@example.com", verified: false, primary: true },
        { value: "verified@example.com", verified: true, primary: false },
      ]),
    ).toBe("verified@example.com");
  });

  it("accepts only HTTP(S) provider avatar URLs", () => {
    expect(selectProviderAvatar([{ value: "https://example.com/avatar.png" }])).toBe(
      "https://example.com/avatar.png",
    );
    expect(selectProviderAvatar([{ value: "javascript:alert(1)" }])).toBeNull();
    expect(selectProviderAvatar([{ value: "not a URL" }])).toBeNull();
  });

  it.each([
    ["google", "google_id", "google-provider-id"],
    ["github", "github_id", "github-provider-id"],
  ])("returns an existing %s provider account", async (provider, providerField, providerId) => {
    const existingUser = await createLocalUser({ [providerField]: providerId });

    const user = await findOrCreateOAuthUser({
      provider,
      providerId,
      name: "Provider User",
      emails: verifiedEmail("provider@example.com"),
      tosAccepted: false,
    });

    expect(user._id.toString()).toBe(existingUser._id.toString());
    expect(await User.countDocuments()).toBe(1);
  });

  it("allows an existing GitHub account to sign in when GitHub omits email data", async () => {
    const existingUser = await createLocalUser({ github_id: "github-provider-id" });

    const user = await findOrCreateOAuthUser({
      provider: "github",
      providerId: "github-provider-id",
      name: "GitHub User",
      emails: undefined,
      tosAccepted: false,
    });

    expect(user._id.toString()).toBe(existingUser._id.toString());
    expect(await User.countDocuments()).toBe(1);
  });

  it("links a verified provider email to an existing account", async () => {
    const existingUser = await createLocalUser();

    const user = await findOrCreateOAuthUser({
      provider: "github",
      providerId: "github-provider-id",
      name: "GitHub User",
      emails: verifiedEmail(existingUser.email),
      photos: [{ value: "https://avatars.githubusercontent.com/u/123" }],
      tosAccepted: false,
    });

    expect(user._id.toString()).toBe(existingUser._id.toString());
    expect(user.github_id).toBe("github-provider-id");
    expect(user.avatar_url).toBe("https://avatars.githubusercontent.com/u/123");
    expect(await User.countDocuments()).toBe(1);
  });

  it("creates an OAuth account only from a verified email and explicit Terms consent", async () => {
    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "google-provider-id",
      name: "Google User",
      emails: verifiedEmail("new-oauth@example.com"),
      photos: [{ value: "https://lh3.googleusercontent.com/avatar" }],
      tosAccepted: true,
    });

    expect(user).toMatchObject({
      name: "Google User",
      email: "new-oauth@example.com",
      google_id: "google-provider-id",
      role: "learner",
      tos_agreement: true,
      avatar_url: "https://lh3.googleusercontent.com/avatar",
    });
    expect(user.email_verified_at).toBeInstanceOf(Date);
    expect(user.tos_agreement_at).toBeInstanceOf(Date);
  });

  it("rejects missing or unverified provider emails without linking an existing account", async () => {
    const existingUser = await createLocalUser();

    await expect(
      findOrCreateOAuthUser({
        provider: "github",
        providerId: "github-provider-id",
        emails: undefined,
        tosAccepted: true,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_VERIFIED_EMAIL_REQUIRED" });

    await expect(
      findOrCreateOAuthUser({
        provider: "github",
        providerId: "github-provider-id",
        emails: [{ value: existingUser.email, verified: false, primary: true }],
        tosAccepted: true,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_VERIFIED_EMAIL_REQUIRED" });

    const unchangedUser = await User.findById(existingUser._id);
    expect(unchangedUser.github_id).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it("requires a provider ID and Terms consent before creating an account", async () => {
    await expect(
      findOrCreateOAuthUser({
        provider: "google",
        providerId: "",
        emails: verifiedEmail("new-oauth@example.com"),
        tosAccepted: true,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_PROVIDER_ID_REQUIRED" });

    await expect(
      findOrCreateOAuthUser({
        provider: "google",
        providerId: "google-provider-id",
        emails: verifiedEmail("new-oauth@example.com"),
        tosAccepted: false,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_TERMS_REQUIRED" });
  });

  it.each([
    ["google", "google_id", "original-google-id", "different-google-id"],
    ["github", "github_id", "original-github-id", "different-github-id"],
  ])(
    "does not overwrite an unrelated %s identity",
    async (provider, providerField, existingProviderId, attemptedProviderId) => {
      const existingUser = await createLocalUser({ [providerField]: existingProviderId });

      await expect(
        findOrCreateOAuthUser({
          provider,
          providerId: attemptedProviderId,
          emails: verifiedEmail(existingUser.email),
          tosAccepted: false,
        }),
      ).rejects.toMatchObject({ code: "OAUTH_IDENTITY_CONFLICT" });

      const unchangedUser = await User.findById(existingUser._id);
      expect(unchangedUser[providerField]).toBe(existingProviderId);
    },
  );

  it("preserves an existing provider identity when linking another provider", async () => {
    const existingUser = await createLocalUser({ github_id: "existing-github-id" });

    const linkedUser = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "new-google-id",
      emails: verifiedEmail(existingUser.email),
      tosAccepted: false,
    });

    expect(linkedUser.google_id).toBe("new-google-id");
    expect(linkedUser.github_id).toBe("existing-github-id");
  });

  it("is idempotent across repeated OAuth logins", async () => {
    const input = {
      provider: "github",
      providerId: "github-provider-id",
      name: "GitHub User",
      emails: verifiedEmail("repeat@example.com"),
      photos: [{ value: "https://avatars.githubusercontent.com/u/first" }],
      tosAccepted: true,
    };

    const firstUser = await findOrCreateOAuthUser(input);
    const secondUser = await findOrCreateOAuthUser({
      ...input,
      photos: [{ value: "https://avatars.githubusercontent.com/u/updated" }],
      tosAccepted: false,
    });

    expect(secondUser._id.toString()).toBe(firstUser._id.toString());
    expect(secondUser.avatar_url).toBe("https://avatars.githubusercontent.com/u/updated");
    expect(await User.countDocuments()).toBe(1);
  });
});
