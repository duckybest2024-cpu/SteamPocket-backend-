import { prisma } from "./prisma";

export async function getSiteConfig(key: string): Promise<string | null> {
  const row = await prisma.siteConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}
