import { getOverview } from "@/lib/dc-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getOverview();
  return Response.json(data, {
    headers: { "cache-control": "no-store" },
  });
}
