// Reglas de Firestore contra el emulador (SPEC §6 y §12). Correr con: pnpm test:rules
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-watch-order",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
/** Escribe datos iniciales sin pasar por las reglas. */
const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

describe("users/{uid}", () => {
  const progress = "users/alice/profiles/default/progress/iron-man-2008";

  it("el dueño lee y escribe todo lo suyo", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), { displayName: "Alice" }));
    await assertSucceeds(setDoc(doc(as("alice"), progress), { status: "watched" }));
    await assertSucceeds(getDoc(doc(as("alice"), progress)));
    await assertSucceeds(deleteDoc(doc(as("alice"), progress)));
  });

  it("otro usuario no puede leer ni escribir", async () => {
    await seed(progress, { status: "watched" });
    await assertFails(getDoc(doc(as("bob"), progress)));
    await assertFails(setDoc(doc(as("bob"), progress), { status: "dropped" }));
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
  });

  it("sin sesión no hay acceso", async () => {
    await seed(progress, { status: "watched" });
    await assertFails(getDoc(doc(anon(), progress)));
    await assertFails(setDoc(doc(anon(), "users/alice"), { displayName: "x" }));
  });
});

describe("shares/{shareId}", () => {
  const share = { ownerUid: "alice", profileId: "default", kind: "route", title: "Spider-Man", snapshot: {}, revoked: false };

  it("cualquiera lee un link activo, incluso sin sesión", async () => {
    await seed("shares/s1", share);
    await assertSucceeds(getDoc(doc(anon(), "shares/s1")));
    await assertSucceeds(getDoc(doc(as("bob"), "shares/s1")));
  });

  it("un link revocado deja de funcionar", async () => {
    await seed("shares/s1", { ...share, revoked: true });
    await assertFails(getDoc(doc(anon(), "shares/s1")));
    await assertFails(getDoc(doc(as("bob"), "shares/s1")));
  });

  it("solo se crea a nombre propio", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "shares/s1"), share));
    await assertFails(setDoc(doc(as("bob"), "shares/s2"), share));
    await assertFails(setDoc(doc(anon(), "shares/s3"), share));
  });

  it("solo el dueño revoca o borra", async () => {
    await seed("shares/s1", share);
    await assertFails(updateDoc(doc(as("bob"), "shares/s1"), { revoked: true }));
    await assertFails(deleteDoc(doc(as("bob"), "shares/s1")));
    await assertSucceeds(updateDoc(doc(as("alice"), "shares/s1"), { revoked: true }));
    await assertSucceeds(deleteDoc(doc(as("alice"), "shares/s1")));
  });
});

describe("groups/{groupId}", () => {
  const group = { name: "Maratón", ownerUid: "alice", members: { alice: "default", bob: "p2" }, inviteCode: "ABC123" };

  it("los miembros leen y editan; los demás no", async () => {
    await seed("groups/g1", group);
    await assertSucceeds(getDoc(doc(as("bob"), "groups/g1")));
    await assertSucceeds(updateDoc(doc(as("bob"), "groups/g1"), { name: "Maratón MCU" }));
    await assertFails(getDoc(doc(as("carol"), "groups/g1")));
    await assertFails(updateDoc(doc(as("carol"), "groups/g1"), { name: "Mío" }));
  });

  it("nadie se une escribiéndose en members: pasa por /api/groups/join", async () => {
    await seed("groups/g1", group);
    await assertFails(
      updateDoc(doc(as("carol"), "groups/g1"), { members: { ...group.members, carol: "default" } }),
    );
  });

  it("solo el dueño crea a su nombre y solo el dueño borra", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "groups/g1"), group));
    await assertFails(setDoc(doc(as("bob"), "groups/g2"), group));
    await assertFails(deleteDoc(doc(as("bob"), "groups/g1")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "groups/g1")));
  });

  it("el progreso del grupo es solo de sus miembros", async () => {
    await seed("groups/g1", group);
    const path = "groups/g1/progress/iron-man-2008";
    await assertSucceeds(setDoc(doc(as("bob"), path), { watchedBy: { bob: new Date() }, watchedTogether: false }));
    await assertSucceeds(getDoc(doc(as("alice"), path)));
    await assertFails(getDoc(doc(as("carol"), path)));
    await assertFails(setDoc(doc(as("carol"), path), { watchedTogether: true }));
    await assertFails(getDoc(doc(anon(), path)));
  });
});
