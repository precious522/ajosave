import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export function GET() {
  const spec = readFileSync(join(process.cwd(), "docs/openapi.yaml"), "utf-8");
  return new NextResponse(spec, {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
}
