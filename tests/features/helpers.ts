import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Points the document store at a throwaway database. Must run before the first import of anything that touches the store. */
export const useTempDb = () => { process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "feat-")), "t.db")}`; };
