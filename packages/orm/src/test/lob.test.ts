import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { LargeObjectManager } from "../client/lob";
import { getTestClient } from "./client.utils";

describe("Lob tests", async () => {
  const client = await getTestClient();

  it("should handle Lob", async () => {
    await client.$transaction(async (c) => {
      const repo = (c.contact as any).unwrap();
      const em = repo.manager;

      const lm = new LargeObjectManager(em);
      const oid = await lm.create();

      expect(oid).toBeGreaterThanOrEqual(0);

      const lob = await lm.open(oid);

      try {
        expect(lob).toBeDefined();

        const buffer = Buffer.from("Hello World!!", "ascii");

        await lob.write(buffer);

        let size = await lob.size();
        expect(size).toBe(`${buffer.length}`);

        await lob.seek(0);

        const readBuffer = await lob.read(buffer.length);
        expect(readBuffer).toBeInstanceOf(Buffer);
        expect(readBuffer.length).toBe(buffer.length);

        expect(readBuffer.toString()).toBe(buffer.toString());

        let pos = await lob.tell();
        expect(pos).toBe(`${readBuffer.length}`);

        await lob.seek(0);
        await lob.truncate(0);

        size = await lob.size();
        expect(size).toBe(`0`);
      } finally {
        await lob.close();
      }
    });
  });

  it("should read/write to stream", async () => {
    await client.$transaction(async (c) => {
      const repo = (c.contact as any).unwrap();
      const em = repo.manager;

      const lm = new LargeObjectManager(em);
      const oid = await lm.create();
      const lob = await lm.open(oid);

      try {
        const { reader, writer } = lob;

        const inFile = __filename;
        const readFileStream = fs.createReadStream(inFile);
        readFileStream.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        const size = await lob.size();
        expect(size > 0).toBeTruthy();

        await lob.seek(0);

        const outDir = fs.mkdtempSync(".tmp.");
        const outFile = path.join(outDir, "lob.test.ts");
        try {
          const writeFileStream = fs.createWriteStream(outFile);
          reader.pipe(writeFileStream);

          await new Promise((resolve, reject) => {
            reader.on("end", resolve);
            reader.on("error", reject);
          });

          const inText = fs.readFileSync(inFile, { encoding: "utf-8" });
          const outText = fs.readFileSync(outFile, { encoding: "utf-8" });

          expect(inText).toBe(outText);
        } finally {
          fs.rmSync(outFile);
          fs.rmdirSync(outDir);
        }
      } finally {
        await lob.close();
      }
    });
  });
});
