import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (value: string | undefined) => {
  vi.resetModules();
  vi.stubEnv("VITE_DONATE_URL", value as string);
  return (await import("./donate")).DONATE_URL;
};

afterEach(() => vi.unstubAllEnvs());

describe("DONATE_URL", () => {
  it("acepta un enlace https", async () => {
    expect(await load("https://checkout.wompi.sv/l/abc123")).toBe("https://checkout.wompi.sv/l/abc123");
  });
  it("sin configurar, o con algo que no es https, no hay botón", async () => {
    expect(await load("")).toBeUndefined();
    expect(await load("http://ejemplo.com/pago")).toBeUndefined();
    expect(await load("javascript:alert(1)")).toBeUndefined();
    expect(await load("no es una url")).toBeUndefined();
  });
});
