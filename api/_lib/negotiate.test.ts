// @vitest-environment node
import { htmlToMarkdown, markdownResponse, negotiate, notAcceptable } from "./negotiate";

describe("negotiate (Accept → HTML o Markdown)", () => {
  it("sin Accept, vacío o */* es HTML", () => {
    expect(negotiate(null)).toBe("html");
    expect(negotiate("")).toBe("html");
    expect(negotiate("*/*")).toBe("html");
  });

  it("lo que manda un navegador es HTML", () => {
    expect(negotiate("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")).toBe("html");
  });

  it("text/markdown pedido por nombre es Markdown", () => {
    expect(negotiate("text/markdown")).toBe("markdown");
    expect(negotiate("text/markdown, text/html;q=0.9")).toBe("markdown");
    expect(negotiate("text/markdown, text/html")).toBe("markdown");
    expect(negotiate("text/markdown;charset=utf-8")).toBe("markdown");
    expect(negotiate("TEXT/MARKDOWN")).toBe("markdown");
  });

  it("respeta los q-values", () => {
    expect(negotiate("text/markdown;q=0.5, text/html")).toBe("html");
    expect(negotiate("text/html;q=0.1, text/markdown;q=0.9")).toBe("markdown");
    expect(negotiate("text/html;q=0, text/*")).toBe("markdown");
    expect(negotiate("text/markdown;q=0, */*")).toBe("html");
  });

  it("null (406) si no acepta ni HTML ni Markdown", () => {
    expect(negotiate("application/json")).toBeNull();
    expect(negotiate("image/png, application/pdf")).toBeNull();
    expect(negotiate("text/html;q=0, text/markdown;q=0")).toBeNull();
  });

  it("text/* sin más es HTML (la representación por defecto)", () => {
    expect(negotiate("text/*")).toBe("html");
  });
});

describe("htmlToMarkdown", () => {
  it("convierte encabezados, párrafos, listas, links y código", () => {
    const md = htmlToMarkdown(
      '<section><h1>Saw</h1><p>Un &amp; dos &quot;tres&quot;</p><h2>Títulos</h2><ol><li><a href="/t/saw-2004">Saw</a> (2004)</li><li>Saw II</li></ol><ul><li><a href="mailto:a@b.dev">a@b.dev</a></li></ul><pre><code>curl &#39;x&#39;</code></pre></section>',
      "https://example.com",
    );
    expect(md).toBe(
      "# Saw\n\nUn & dos \"tres\"\n\n## Títulos\n\n1. [Saw](https://example.com/t/saw-2004) (2004)\n2. Saw II\n\n- [a@b.dev](mailto:a@b.dev)\n\n```\ncurl 'x'\n```\n",
    );
  });
});

describe("respuestas", () => {
  it("Markdown con Content-Type text/markdown y Vary: Accept", async () => {
    const res = markdownResponse("# Hola\n", { cacheControl: "no-store", status: 404 });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(await res.text()).toBe("# Hola\n");
  });

  it("406 dice qué tipos hay", async () => {
    const res = notAcceptable();
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toBe("Accept");
    expect(await res.text()).toMatch(/text\/html.*text\/markdown/);
  });
});
