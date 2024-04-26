import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
  spawnSync,
} from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";

const generateName = () => crypto.randomUUID();
const generatePort = () => {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      let info = srv.address();
      let port = 6543;
      if (info && typeof info === "object") {
        port = info.port!;
      }
      srv.close(() => resolve(port));
    });
  });
};

const which = async (command: string) => {
  return new Promise<string>((resolve, reject) => {
    let sub = spawn("which", [command]);
    let res: string = "";
    sub.on("exit", (exitCode) => {
      if (exitCode === 0) resolve(res.trim());
      if (exitCode !== 0) reject(`command '${command}' not found.`);
    });
    sub.stdout.on("data", (chunk) => {
      res += chunk.toString("utf-8");
    });
  });
};

const waitForOutput = async (proc: ChildProcess, text: string) => {
  return new Promise((resolve) => {
    let log = "";
    let listener = (chunk: any) => {
      log += chunk.toString();
      if (log.includes(text)) {
        proc.stderr?.off("data", listener);
        proc.stdout?.off("data", listener);
        setTimeout(resolve, 100);
      }
    };
    proc.stderr?.on("data", listener);
    proc.stdout?.on("data", listener);
  });
};

export type RunOptions = {
  cwd?: string;
  verbose?: boolean;
  nothrow?: boolean;
  timeout?: number;
};

export const run = async (
  command: string,
  args: readonly string[],
  options?: RunOptions,
) => {
  const {
    cwd = process.cwd(),
    verbose = true,
    nothrow = false,
  } = options ?? {};
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      windowsHide: true,
    });
    if (verbose) {
      proc.stdout.pipe(process.stdout);
      proc.stderr.pipe(process.stderr);
    }
    if (nothrow) {
      proc.on("error", () => {});
    }
    setTimeout(() => resolve(proc));
  });
};

export const createPostgresContainer = async () => {
  const cmd = await which("docker").catch(() => which("podman"));
  const port = await generatePort();
  const name = generateName();
  const pg = await run(cmd, [
    "run",
    "--rm",
    "--name",
    name,
    "-e",
    "POSTGRES_USER=test",
    "-e",
    "POSTGRES_PASSWORD=test",
    "-e",
    "POSTGRES_DATABASE=test",
    "-p",
    `${port}:5432`,
    "postgres:alpine",
  ]);

  await waitForOutput(pg, "CREATE DATABASE");
  await waitForOutput(pg, "database system is ready to accept connections");

  const host = process.env.HOSTNAME ?? "localhost";
  const url = `postgres://test:test@${host}:${port}/test`;
  const stop = async () => {
    pg.kill("SIGINT");
    await waitForOutput(pg, "database system is shut down");
  };

  // make sure to close the container in all cases
  process.on("exit", () => spawnSync(cmd, ["stop", name]));

  return {
    url,
    stop,
  };
};
