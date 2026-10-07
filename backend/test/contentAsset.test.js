const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/User.model");
const ContentAsset = require("../src/models/ContentAsset.model");

useTestDb();

async function createUser(role) {
  return User.create({
    name: `${role} uploader`,
    email: `${role}-avatar@example.com`,
    password_hash: "not-a-real-hash",
    role,
    tos_agreement: true,
    email_verified_at: new Date(),
  });
}

const authHeader = (user) =>
  `Bearer ${jwt.sign(
    { id: String(user._id), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  )}`;

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("avatar content assets", () => {
  it("requires an admin to upload avatars", async () => {
    const learner = await createUser("learner");
    const response = await request(app)
      .post("/api/v1/admin/assets/avatars")
      .set("Authorization", authHeader(learner));

    expect(response.status).toBe(403);
  });

  it("stores a valid avatar and serves its public URL", async () => {
    const admin = await createUser("admin");
    const uploadResponse = await request(app)
      .post("/api/v1/admin/assets/avatars")
      .set("Authorization", authHeader(admin))
      .attach("file", pngSignature, { filename: "nova.png", contentType: "image/png" });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body).toMatchObject({
      name: "nova.png",
      mimeType: "image/png",
      url: `/api/v1/assets/${uploadResponse.body.id}`,
    });

    const asset = await ContentAsset.findOne({ asset_id: uploadResponse.body.id });
    expect(Buffer.from(asset.data).equals(pngSignature)).toBe(true);

    const listResponse = await request(app)
      .get("/api/v1/admin/assets/avatars")
      .set("Authorization", authHeader(admin));
    expect(listResponse.body.assets).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: uploadResponse.body.id })]),
    );

    const publicResponse = await request(app).get(uploadResponse.body.url);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers["content-type"]).toBe("image/png");
    expect(publicResponse.body).toEqual(pngSignature);
  });

  it("rejects image files whose signature does not match their MIME type", async () => {
    const admin = await createUser("admin");
    const response = await request(app)
      .post("/api/v1/admin/assets/avatars")
      .set("Authorization", authHeader(admin))
      .attach("file", Buffer.from("not an image"), {
        filename: "fake.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
  });
});
