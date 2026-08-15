"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function findBash() {
  const candidates = [process.env.BASH, "bash", "C:\\Program Files\\Git\\bin\\bash.exe"].filter(
    Boolean
  );
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["-lc", "echo ok"], { encoding: "utf8" });
    if (r.status === 0 && String(r.stdout || "").includes("ok")) return cmd;
  }
  return null;
}

describe("scripts/backup-db.sh", () => {
  const bash = findBash();
  const script = path.join(__dirname, "..", "scripts", "backup-db.sh");

  test("bash syntax is valid", () => {
    if (!bash) return;
    const r = spawnSync(bash, ["-n", script], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stderr || "").toBe("");
  });

  test("loads .env with literal $2 and writes a non-empty gzip dump", () => {
    if (!bash) return;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backup-db-"));
    const bin = path.join(tmp, "bin");
    const backups = path.join(tmp, "backups");
    fs.mkdirSync(bin);
    fs.mkdirSync(backups);
    fs.writeFileSync(
      path.join(tmp, ".env"),
      [
        "JWT_SECRET=abc$2xy$2z",
        "DB_HOST=127.0.0.1",
        "DB_PORT=3306",
        "DB_USER=root",
        "DB_PASSWORD=unused-pass",
        "DB_NAME=jobportal_test",
        ""
      ].join("\n")
    );
    const dumpStub = path.join(bin, "mysqldump");
    fs.writeFileSync(
      dumpStub,
      "#!/usr/bin/env bash\nprintf '%s\\n' '-- MySQL dump stub' 'CREATE TABLE t (id int);'\n"
    );
    fs.chmodSync(dumpStub, 0o755);

    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH || ""}` };
    delete env.MYSQL_PWD;
    const r = spawnSync(
      bash,
      [script],
      {
        encoding: "utf8",
        env: {
          ...env,
          BACKUP_ENV_FILE: path.join(tmp, ".env"),
          BACKUP_DIR: backups
        }
      }
    );
    if (r.status !== 0) {
      throw new Error(`backup failed status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    }
    expect(r.stderr || "").not.toMatch(/unbound variable/);
    expect(r.stdout).toMatch(/Backup written:/);
    expect(r.stdout).toMatch(/Database: jobportal_test/);
    expect(r.stdout).toMatch(/Gzip integrity: ok/);
    expect(r.stdout).not.toMatch(/unused-pass/);
    const files = fs.readdirSync(backups).filter((f) => f.endsWith(".sql.gz"));
    expect(files.length).toBe(1);
    const dumpPath = path.join(backups, files[0]);
    expect(fs.statSync(dumpPath).size).toBeGreaterThan(0);
  });
});
