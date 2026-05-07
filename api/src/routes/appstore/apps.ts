import { Hono } from "hono";
import { ascFetch } from "../../services/apple/auth.ts";

const router = new Hono();

router.get("/", async (c) => {
  try {
    const res = await ascFetch(
      "https://api.appstoreconnect.apple.com/v1/apps?sort=bundleId&fields[apps]=name,bundleId,sku&limit=50",
    );

    if (!res.ok) {
      const text = await res.text();
      return c.json(
        { error: `Apple API error: ${res.status}`, detail: text },
        502,
      );
    }

    const json = (await res.json()) as {
      data: Array<{
        id: string;
        attributes: { name: string; bundleId: string; sku: string };
      }>;
    };

    const apps = (json.data ?? []).map((item) => ({
      id: item.id,
      name: item.attributes?.name ?? "",
      bundleId: item.attributes?.bundleId ?? "",
      sku: item.attributes?.sku ?? "",
    }));

    console.log("apps", apps);
    return c.json({ apps });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

export default router;
