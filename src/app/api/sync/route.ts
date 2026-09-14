import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";

let syncing = false;

export async function GET() {
  return NextResponse.json({ syncing });
}

export async function POST() {
  if (syncing) {
    return NextResponse.json({ status: "already-running" }, { status: 429 });
  }
  syncing = true;

  const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
  const pollScript = path.join(process.cwd(), "scripts", "poll.ts");

  const child = spawn(tsxBin, [pollScript], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });

  child.on("exit", () => {
    syncing = false;
  });
  child.on("error", (err) => {
    console.error("Manual sync failed to start:", err);
    syncing = false;
  });

  return NextResponse.json({ status: "started" });
}
