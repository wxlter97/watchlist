const scripts = () => document.head.querySelectorAll('script[src*="googletagmanager"]').length;

async function load(id?: string) {
  vi.resetModules();
  if (id) vi.stubEnv("VITE_GA_ID", id);
  else vi.stubEnv("VITE_GA_ID", "");
  localStorage.clear();
  document.head.innerHTML = "";
  delete window.dataLayer;
  const consent = await import("./consent");
  const analytics = await import("./analytics");
  return { ...consent, ...analytics };
}

afterEach(() => vi.unstubAllEnvs());

describe("Google Analytics", () => {
  it("sin ID configurado no hace nada, ni con consentimiento", async () => {
    const { track, setConsent, ANALYTICS_ENABLED } = await load();
    setConsent("granted");
    track("follow_franchise", { franchise_id: "saw" });
    expect(ANALYTICS_ENABLED).toBe(false);
    expect(scripts()).toBe(0);
  });

  it("no carga el script ni envía eventos hasta que se acepta", async () => {
    const { track } = await load("G-TEST");
    track("follow_franchise", { franchise_id: "saw" });
    expect(scripts()).toBe(0);
    expect(window.dataLayer).toBeUndefined();
  });

  it("rechazar tampoco carga nada", async () => {
    const { track, setConsent } = await load("G-TEST");
    setConsent("denied");
    track("title_watched");
    expect(scripts()).toBe(0);
  });

  it("tras aceptar carga el script una sola vez, sin señales de Google, y envía el evento", async () => {
    const { track, setConsent } = await load("G-TEST");
    setConsent("granted");
    track("title_watched", { kind: "movie" });
    track("title_watched", { kind: "series" });
    expect(scripts()).toBe(1);
    const entries = (window.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>));
    expect(entries).toContainEqual(["config", "G-TEST", { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
    expect(entries.filter((e) => e[0] === "event" && e[1] === "title_watched")).toHaveLength(2);
  });

  it("retirar el permiso desactiva el envío", async () => {
    const { track, setConsent } = await load("G-TEST");
    setConsent("granted");
    track("a");
    const before = (window.dataLayer ?? []).length;
    setConsent(undefined);
    track("b");
    expect((window.dataLayer ?? []).length).toBe(before);
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
  });
});
