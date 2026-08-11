import { spawn } from "node:child_process";

const input = process.argv.slice(2);
const forwarded = [];

for (let index = 0; index < input.length; index += 1) {
  const value = input[index];
  if (value === "--host") {
    forwarded.push("--hostname", input[index + 1]);
    index += 1;
    continue;
  }
  if (value === "--strictPort") continue;
  forwarded.push(value);
}

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...forwarded],
  { stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
