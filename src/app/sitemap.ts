import { MetadataRoute } from "next";
import { query } from "@/lib/db";

const BASE_URL = "https://www.ajosave.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { rows } = await query<{ id: string; updated_at: string }>(
    `SELECT id, updated_at FROM circles WHERE circle_type = 'public' AND status = 'open' ORDER BY created_at DESC`
  );

  const circleUrls: MetadataRoute.Sitemap = rows.map((circle) => ({
    url: `${BASE_URL}/circles/${circle.id}`,
    lastModified: new Date(circle.updated_at),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/circles`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/help`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...circleUrls,
  ];
}
