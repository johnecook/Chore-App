import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const testsDir = resolve(projectRoot, "supabase/tests");
const databaseUrl =
  process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function runPsql(file) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      "psql",
      [
        databaseUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-c",
        "begin;",
        "-f",
        file,
        "-c",
        "rollback;",
      ],
      {
        stdio: "pipe",
      },
    );

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk;
    });

    child.stderr.on("data", (chunk) => {
      output += chunk;
    });

    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun(output);
        return;
      }

      rejectRun(new Error(output.trim() || `psql exited with status ${code}`));
    });
  });
}

const files = (await readdir(testsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => resolve(testsDir, file));

for (const file of files) {
  const label = file.replace(`${testsDir}/`, "");
  process.stdout.write(`Running ${label}... `);
  await runPsql(file);
  process.stdout.write("ok\n");
}

console.log(`Passed ${files.length} Supabase smoke tests.`);
