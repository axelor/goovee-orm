import { Readable, Writable } from "node:stream";
import { EntityManager } from "typeorm";

enum Mode {
  WRITE = 0x00020000,
  READ = 0x00040000,
  READWRITE = Mode.READ | Mode.WRITE,
}

enum Seek {
  SET = 0,
  CUR = 1,
  END = 2,
}

class LobError extends Error {}

class LobClient {
  #em;
  constructor(em: EntityManager) {
    this.#em = em;
  }

  async query(query: string, ...params: any) {
    const res = await this.#em.query(query, params);
    const arr = res as any[];
    return arr[0];
  }

  async lo_create(): Promise<number> {
    const { oid } = await this.query("SELECT lo_create(0) as oid");
    if (oid < 0) {
      throw new LobError("Unable to create LargeObject");
    }
    return oid;
  }

  async lo_unlink(oid: number) {
    const { res } = await this.query("SELECT lo_create(0) as oid");
    if (res < 0) {
      throw new LobError(`Unable to remove LargeObject: ${oid}`);
    }
  }

  async lo_open(oid: number, mode: Mode = Mode.READWRITE): Promise<number> {
    const { fd } = await this.query("SELECT lo_open($1, $2) as fd", oid, mode);
    if (fd < 0) {
      throw new LobError(`Unable to open LargeObject: ${oid}`);
    }
    return fd;
  }

  async lo_close(oid: number, fd: number) {
    const { res } = await this.query("select lo_close($1) as res", fd);
    if (res < 0) {
      throw new LobError(`Unable to close LargeObject: ${oid}`);
    }
  }

  async lo_tell(oid: number, fd: number): Promise<number | string> {
    const { pos } = await this.query("select lo_tell64($1) as pos", fd);
    if (pos < 0) {
      throw new LobError(
        `Unable to get current position in LargeObject: ${oid}`,
      );
    }
    return pos;
  }

  async lo_seek(
    oid: number,
    fd: number,
    position: number | string,
    ref: number = Seek.SET,
  ) {
    const { pos } = await this.query(
      "select lo_lseek64($1, $2, $3) as pos",
      fd,
      position,
      ref,
    );

    if (pos < 0) {
      throw new LobError(
        `Unable to set current position within LargeObject: ${oid}`,
      );
    }
  }

  async lo_read(oid: number, fd: number, length: number): Promise<Buffer> {
    const { data } = await this.query(
      "select loread($1, $2) as data",
      fd,
      length,
    );
    return data;
  }

  async lo_write(oid: number, fd: number, buffer: Buffer) {
    const { length } = await this.query(
      "select lowrite($1, $2) as length",
      fd,
      buffer,
    );
    if (length < 0) {
      throw new LobError(`Unable to write to LargeObject: ${oid}`);
    }
  }

  async lo_truncate(oid: number, fd: number, length: number | string) {
    const { size } = await this.query(
      "select lo_truncate64($1, $2) as size",
      fd,
      length,
    );
    if (size < 0) {
      throw new LobError(`Unable to truncate LargeObject: ${oid}`);
    }
  }
}

/**
 * This class implements the large object interface similar to postgresql JDBC driver.
 *
 */
export class LargeObjectManager {
  #client;

  /**
   * Create a new instance.
   *
   * @param client the client
   */
  constructor(em: EntityManager) {
    this.#client = new LobClient(em);
  }

  /**
   * This creates a large object, returning its OID.
   *
   * @returns oid of new object
   */
  async create(): Promise<number> {
    return await this.#client.lo_create();
  }

  /**
   * This deletes a large object.
   *
   * @param oid the oid of the object to delete
   */
  async delete(oid: number) {
    await this.#client.lo_unlink(oid);
  }

  /**
   * This opens an existing large object, based on its OID.
   *
   * @param oid of large object
   * @returns {@link LargeObject} instance providing access to the object
   */
  async open(oid: number, mode: Mode = Mode.READWRITE): Promise<LargeObject> {
    const fd = await this.#client.lo_open(oid, mode);
    const lob = new LargeObject(this.#client, oid, fd);
    return lob;
  }
}

class LobReader extends Readable {
  #lob;
  constructor(lob: LargeObject, bufferSize: number = 4096) {
    super({ highWaterMark: bufferSize, objectMode: false });
    this.#lob = lob;
  }

  _read(size: number) {
    this.#lob.read(size).then((data) => {
      this.push(data);
      if (data.length < size) {
        this.push(null); // end
      }
    });
  }
}

class LobWriter extends Writable {
  #lob;
  constructor(lob: LargeObject, bufferSize: number = 1024) {
    super({
      highWaterMark: bufferSize,
      decodeStrings: true,
      objectMode: false,
    });
    this.#lob = lob;
  }

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ) {
    this.#lob.write(chunk).then((data) => callback(), callback);
  }
}

export class LargeObject {
  #client;
  #oid;
  #fd;

  #reader: Readable;
  #writer: Writable;

  constructor(client: LobClient, oid: number, fd: number) {
    this.#client = client;
    this.#oid = oid;
    this.#fd = fd;

    this.#reader = new LobReader(this);
    this.#writer = new LobWriter(this);
  }

  /**
   * LargeObject id
   */
  get oid() {
    return this.#oid;
  }

  /**
   * The {@link Readable} stream
   */
  get reader() {
    return this.#reader;
  }

  /**
   * The {@link Writable} stream
   */
  get writer() {
    return this.#writer;
  }

  /**
   * This method closes the object.
   *
   * You must not call methods in this object after this is called.
   */
  async close() {
    await this.#client.lo_close(this.#oid, this.#fd);
  }

  /**
   * This method finds out the size of the object.
   *
   * @returns the size of the large object
   */
  async size(): Promise<number | string> {
    const cp = await this.tell();
    await this.seek(0, Seek.END);
    const sz = await this.tell();
    await this.seek(cp, Seek.SET);
    return sz;
  }

  /**
   * This method tells current position.
   *
   * @returns the current position within the object
   */
  async tell(): Promise<number | string> {
    return await this.#client.lo_tell(this.#oid, this.#fd);
  }

  /**
   * Sets the current position within the object.
   *
   * @param position position within object from beginning
   */
  async seek(position: number | string, ref: number = Seek.SET) {
    await this.#client.lo_seek(this.#oid, this.#fd, position, ref);
  }

  /**
   * Reads some data from the object, and return as a {@link Buffer}.
   *
   * @param length number of bytes to read
   * @returns buffer containing data read
   */
  async read(length: number): Promise<Buffer> {
    return await this.#client.lo_read(this.#oid, this.#fd, length);
  }

  /**
   * Writes a buffer to the object.
   *
   * @param buffer buffer to write
   */
  async write(buffer: Buffer) {
    await this.#client.lo_write(this.#oid, this.#fd, buffer);
  }

  /**
   * Truncates the large object to the given length in bytes.
   *
   * If the number of bytes is larger than the current large object length,
   * the large object will be filled with zero bytes. This method does not
   * modify the current file offset.
   *
   * @param length given length in bytes
   *
   */
  async truncate(length: number | string) {
    await this.#client.lo_truncate(this.#oid, this.#fd, length);
  }
}

export const createLob = async (em: EntityManager, buffer: Buffer) => {
  if (!buffer || buffer.length === 0) return null;
  const lm = new LargeObjectManager(em);
  const oid = await lm.create();
  const lob = await lm.open(oid);
  await lob.write(buffer);
  return oid;
};

export const readLob = async (em: EntityManager, oid: number) => {
  if (oid === null || oid === undefined) return null;
  const lm = new LargeObjectManager(em);
  const lob = await lm.open(oid);
  const size = BigInt(await lob.size());
  let buffer = await lob.read(1024);
  while (buffer.length < size) {
    const next = await lob.read(1024);
    buffer = Buffer.concat([buffer, next]);
  }
  return buffer;
};
