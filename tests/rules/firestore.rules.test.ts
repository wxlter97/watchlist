// Reglas de Firestore contra el emulador (SPEC §6 y §12). Correr con: pnpm test:rules
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

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
  it("los planes (y el secreto de su feed) son solo del dueño", async () => {
    const plan = "users/alice/profiles/default/plans/p1";
    await assertSucceeds(setDoc(doc(as("alice"), plan), { name: "Maratón", feedToken: "a".repeat(64) }));
    await assertFails(getDoc(doc(as("bob"), plan)));
    await assertFails(getDoc(doc(anon(), plan)));
    await assertFails(setDoc(doc(as("bob"), plan), { name: "x" }));
  });

  it("los logros desbloqueados son solo del dueño", async () => {
    const unlock = "users/alice/profiles/default/achievements/first-title";
    await assertSucceeds(setDoc(doc(as("alice"), unlock), { unlockedAt: new Date() }));
    await assertFails(getDoc(doc(as("bob"), unlock)));
    await assertFails(setDoc(doc(as("bob"), unlock), { unlockedAt: new Date() }));
  });
});

describe("shares/{shareId}", () => {
  const share = { ownerUid: "alice", profileId: "default", kind: "route", title: "Spider-Man", snapshot: {}, revoked: false };

  it("cualquiera lee un link activo, incluso sin sesión", async () => {
    await seed("shares/s1", share);
    await assertSucceeds(getDoc(doc(anon(), "shares/s1")));
    await assertSucceeds(getDoc(doc(as("bob"), "shares/s1")));
  });

  it("un link revocado deja de funcionar, salvo para su dueño", async () => {
    await seed("shares/s1", { ...share, revoked: true });
    await assertFails(getDoc(doc(anon(), "shares/s1")));
    await assertFails(getDoc(doc(as("bob"), "shares/s1")));
    await assertSucceeds(getDoc(doc(as("alice"), "shares/s1")));
  });

  it("el dueño lista sus links, activos y revocados", async () => {
    await seed("shares/s1", share);
    await seed("shares/s2", { ...share, revoked: true });
    await seed("shares/s3", { ...share, ownerUid: "bob" });
    const mine = await assertSucceeds(getDocs(query(collection(as("alice"), "shares"), where("ownerUid", "==", "alice"))));
    expect(mine.size).toBe(2);
    await assertFails(getDocs(query(collection(as("bob"), "shares"), where("ownerUid", "==", "alice"))));
  });

  it("nadie enumera los links de todos, ni siquiera los activos", async () => {
    await seed("shares/s1", share);
    await assertFails(getDocs(collection(anon(), "shares")));
    await assertFails(getDocs(query(collection(anon(), "shares"), where("revoked", "==", false))));
    await assertFails(getDocs(query(collection(as("bob"), "shares"), where("revoked", "==", false))));
  });

  it("solo se crea a nombre propio, activo y de un tipo conocido", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "shares/s1"), share));
    await assertFails(setDoc(doc(as("bob"), "shares/s2"), share));
    await assertFails(setDoc(doc(anon(), "shares/s3"), share));
    await assertFails(setDoc(doc(as("alice"), "shares/s4"), { ...share, kind: "everything" }));
    await assertFails(setDoc(doc(as("alice"), "shares/s5"), { ...share, revoked: true }));
  });

  it("solo el dueño revoca o borra, y no puede regalarlo", async () => {
    await seed("shares/s1", share);
    await assertFails(updateDoc(doc(as("bob"), "shares/s1"), { revoked: true }));
    await assertFails(deleteDoc(doc(as("bob"), "shares/s1")));
    await assertFails(updateDoc(doc(as("alice"), "shares/s1"), { ownerUid: "bob" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "shares/s1"), { revoked: true }));
    await assertSucceeds(deleteDoc(doc(as("alice"), "shares/s1")));
  });
});

describe("groups/{groupId}", () => {
  const group = {
    name: "Maratón",
    ownerUid: "alice",
    members: { alice: "default", bob: "p2" },
    memberUids: ["alice", "bob"],
    memberNames: { alice: "Alice", bob: "Bob" },
    inviteCode: "ABC123",
  };
  const solo = { ...group, members: { alice: "default" }, memberUids: ["alice"], memberNames: { alice: "Alice" } };

  it("los miembros leen; los demás no", async () => {
    await seed("groups/g1", group);
    await assertSucceeds(getDoc(doc(as("bob"), "groups/g1")));
    await assertFails(getDoc(doc(as("carol"), "groups/g1")));
    await assertFails(getDoc(doc(anon(), "groups/g1")));
  });

  it("cada uno lista sus grupos con array-contains", async () => {
    await seed("groups/g1", group);
    await seed("groups/g2", { ...solo, ownerUid: "carol", members: { carol: "x" }, memberUids: ["carol"], memberNames: { carol: "C" } });
    const mine = await assertSucceeds(getDocs(query(collection(as("bob"), "groups"), where("memberUids", "array-contains", "bob"))));
    expect(mine.size).toBe(1);
  });

  it("se crea solo con uno mismo como dueño y único miembro", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "groups/g1"), solo));
    await assertFails(setDoc(doc(as("alice"), "groups/g2"), group)); // ya con bob adentro
    await assertFails(setDoc(doc(as("bob"), "groups/g3"), solo)); // a nombre de otro
  });

  it("el dueño edita y saca miembros; no agrega ni cede el grupo", async () => {
    await seed("groups/g1", group);
    await assertSucceeds(updateDoc(doc(as("alice"), "groups/g1"), { name: "Maratón MCU", inviteCode: "XYZ789" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "groups/g1"), { members: solo.members, memberUids: solo.memberUids, memberNames: solo.memberNames }));
    await seed("groups/g2", group);
    await assertFails(
      updateDoc(doc(as("alice"), "groups/g2"), {
        members: { ...group.members, carol: "x" },
        memberUids: [...group.memberUids, "carol"],
        memberNames: { ...group.memberNames, carol: "C" },
      }),
    );
    await assertFails(updateDoc(doc(as("alice"), "groups/g2"), { ownerUid: "bob" }));
  });

  it("un miembro no edita el grupo ni a otros, pero puede salirse", async () => {
    await seed("groups/g1", group);
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { name: "Mío" }));
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { ownerUid: "bob" }));
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { members: { bob: "p2" }, memberUids: ["bob"], memberNames: { bob: "Bob" } }));
    await assertSucceeds(updateDoc(doc(as("bob"), "groups/g1"), { members: solo.members, memberUids: solo.memberUids, memberNames: solo.memberNames }));
  });

  it("nadie se une escribiéndose en members: pasa por /api/groups/join", async () => {
    await seed("groups/g1", group);
    await assertFails(
      updateDoc(doc(as("carol"), "groups/g1"), {
        members: { ...group.members, carol: "default" },
        memberUids: [...group.memberUids, "carol"],
        memberNames: { ...group.memberNames, carol: "Carol" },
      }),
    );
  });

  it("el dueño no se sale de su grupo (lo borra) ni deja members y memberUids desalineados", async () => {
    await seed("groups/g1", group);
    const bobOnly = { members: { bob: "p2" }, memberUids: ["bob"], memberNames: { bob: "Bob" } };
    await assertFails(updateDoc(doc(as("alice"), "groups/g1"), bobOnly));
    await assertFails(updateDoc(doc(as("alice"), "groups/g1"), { memberUids: ["alice"] }));
    await assertFails(updateDoc(doc(as("alice"), "groups/g1"), { memberNames: { ...group.memberNames, carol: "C" } }));
  });

  it("al salirse, un miembro solo se quita a sí mismo y no toca nada más", async () => {
    await seed("groups/g1", { ...group, members: { ...group.members, carol: "x" }, memberUids: ["alice", "bob", "carol"], memberNames: { ...group.memberNames, carol: "C" } });
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { ...solo, name: "Adiós" })); // se sale y además quita a carol y renombra
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { members: solo.members, memberUids: solo.memberUids, memberNames: solo.memberNames }));
    await assertSucceeds(
      updateDoc(doc(as("bob"), "groups/g1"), { members: { alice: "default", carol: "x" }, memberUids: ["alice", "carol"], memberNames: { alice: "Alice", carol: "C" } }),
    );
  });

  it("quien sale del grupo pierde el acceso a su progreso", async () => {
    await seed("groups/g1", solo);
    await seed("groups/g1/progress/iron-man-2008", { watchedBy: { bob: new Date() }, watchedTogether: false });
    await assertFails(getDoc(doc(as("bob"), "groups/g1")));
    await assertFails(getDoc(doc(as("bob"), "groups/g1/progress/iron-man-2008")));
    await assertFails(updateDoc(doc(as("bob"), "groups/g1/progress/iron-man-2008"), { watchedTogether: true }));
  });

  it("solo el dueño borra", async () => {
    await seed("groups/g1", group);
    await assertFails(deleteDoc(doc(as("bob"), "groups/g1")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "groups/g1")));
  });

  it("en el progreso del grupo cada miembro marca solo lo suyo", async () => {
    await seed("groups/g1", group);
    const path = "groups/g1/progress/iron-man-2008";
    await assertSucceeds(setDoc(doc(as("bob"), path), { watchedBy: { bob: new Date() }, watchedTogether: false }));
    await assertSucceeds(getDoc(doc(as("alice"), path)));
    await assertFails(updateDoc(doc(as("alice"), path), { "watchedBy.bob": new Date(2000, 0, 1) }));
    await assertSucceeds(updateDoc(doc(as("alice"), path), { "watchedBy.alice": new Date(), watchedTogether: true }));
    await assertFails(getDoc(doc(as("carol"), path)));
    await assertFails(setDoc(doc(as("carol"), path), { watchedBy: {}, watchedTogether: true }));
    await assertFails(setDoc(doc(as("bob"), "groups/g1/progress/thor-2011"), { watchedBy: { alice: new Date() }, watchedTogether: false }));
    await assertFails(getDoc(doc(anon(), path)));
    await assertFails(deleteDoc(doc(as("bob"), path)));
    await assertSucceeds(deleteDoc(doc(as("alice"), path)));
  });
});

describe("system/", () => {
  it("nadie lo toca desde el cliente", async () => {
    await assertFails(getDoc(doc(as("alice"), "system/providers")));
    await assertFails(setDoc(doc(as("alice"), "system/providers"), { x: 1 }));
  });
});
