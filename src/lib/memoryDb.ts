import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

type Row = Record<string, any>;

// ─── Errors ───────────────────────────────────────────────────────────────

export class UniqueConstraintError extends Error {
  code = "P2002";
  meta: { target: string[] };
  constructor(target: string[]) {
    super(`Unique constraint failed on the fields: (${target.join(", ")})`);
    this.meta = { target };
  }
}

export class NotFoundError extends Error {
  code = "P2025";
  constructor(msg = "Record not found") {
    super(msg);
  }
}

// ─── Where-clause matching ────────────────────────────────────────────────

function valueMatches(fieldVal: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return fieldVal === null || fieldVal === undefined;
  if (cond instanceof Date) return fieldVal instanceof Date && fieldVal.getTime() === cond.getTime();
  if (typeof cond !== "object") return fieldVal === cond;

  let result = true;
  if ("equals" in cond) result = result && fieldVal === cond.equals;
  if ("not" in cond) {
    const notVal = cond.not;
    if (notVal !== null && typeof notVal === "object" && !(notVal instanceof Date)) {
      result = result && !valueMatches(fieldVal, notVal);
    } else {
      result = result && fieldVal !== notVal;
    }
  }
  if ("in" in cond) result = result && cond.in.includes(fieldVal);
  if ("notIn" in cond) result = result && !cond.notIn.includes(fieldVal);
  if ("gt" in cond) result = result && fieldVal > cond.gt;
  if ("gte" in cond) result = result && fieldVal >= cond.gte;
  if ("lt" in cond) result = result && fieldVal < cond.lt;
  if ("lte" in cond) result = result && fieldVal <= cond.lte;
  const insensitive = cond.mode === "insensitive";
  const norm = (v: any) => (insensitive ? String(v).toLowerCase() : String(v));
  if ("contains" in cond) result = result && norm(fieldVal).includes(norm(cond.contains));
  if ("startsWith" in cond) result = result && norm(fieldVal).startsWith(norm(cond.startsWith));
  if ("endsWith" in cond) result = result && norm(fieldVal).endsWith(norm(cond.endsWith));
  return result;
}

function matchWhere(record: Row, where: any, compoundKeys: Record<string, string[]> = {}): boolean {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    const val = where[key];
    if (val === undefined) continue;
    if (key === "OR") {
      if (!val.some((w: any) => matchWhere(record, w, compoundKeys))) return false;
      continue;
    }
    if (key === "AND") {
      if (!val.every((w: any) => matchWhere(record, w, compoundKeys))) return false;
      continue;
    }
    if (key === "NOT") {
      if (Array.isArray(val)) {
        if (val.some((w: any) => matchWhere(record, w, compoundKeys))) return false;
      } else if (matchWhere(record, val, compoundKeys)) {
        return false;
      }
      continue;
    }
    if (compoundKeys[key]) {
      const fields = compoundKeys[key];
      if (!fields.every((f) => record[f] === val[f])) return false;
      continue;
    }
    if (!valueMatches(record[key], val)) return false;
  }
  return true;
}

function applyOrderBy(arr: Row[], orderBy: any): Row[] {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...arr].sort((a, b) => {
    for (const ord of orders) {
      for (const field of Object.keys(ord)) {
        const dir = ord[field];
        let av = a[field];
        let bv = b[field];
        if (av instanceof Date) av = av.getTime();
        if (bv instanceof Date) bv = bv.getTime();
        if (av < bv) return dir === "desc" ? 1 : -1;
        if (av > bv) return dir === "desc" ? -1 : 1;
      }
    }
    return 0;
  });
}

function applyUpdateData(row: Row, data: Row): Row {
  const next = { ...row };
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== null && typeof val === "object" && !(val instanceof Date) && !Array.isArray(val)) {
      if ("increment" in val) {
        next[key] = (next[key] ?? 0) + val.increment;
        continue;
      }
      if ("decrement" in val) {
        next[key] = (next[key] ?? 0) - val.decrement;
        continue;
      }
      if ("multiply" in val) {
        next[key] = (next[key] ?? 0) * val.multiply;
        continue;
      }
      if ("set" in val) {
        next[key] = val.set;
        continue;
      }
    }
    next[key] = val;
  }
  return next;
}

// ─── Aggregation ──────────────────────────────────────────────────────────

function buildAggregateResult(arr: Row[], args: any): Row {
  const result: Row = {};
  if (args._count) {
    if (args._count === true) {
      result._count = arr.length;
    } else {
      result._count = {};
      for (const f of Object.keys(args._count)) {
        result._count[f] = f === "_all" ? arr.length : arr.filter((r) => r[f] !== undefined && r[f] !== null).length;
      }
    }
  }
  for (const op of ["_sum", "_avg", "_min", "_max"] as const) {
    if (!args[op]) continue;
    result[op] = {};
    for (const f of Object.keys(args[op])) {
      const vals = arr.map((r) => r[f]).filter((v) => v !== undefined && v !== null);
      if (op === "_sum") result[op][f] = vals.reduce((s: number, v: number) => s + v, 0);
      if (op === "_avg") result[op][f] = vals.length ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : null;
      if (op === "_min") result[op][f] = vals.length ? vals.reduce((a: any, b: any) => (a < b ? a : b)) : null;
      if (op === "_max") result[op][f] = vals.length ? vals.reduce((a: any, b: any) => (a > b ? a : b)) : null;
    }
  }
  return result;
}

function applyGroupOrderBy(arr: Row[], orderBy: any): Row[] {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...arr].sort((a, b) => {
    for (const ord of orders) {
      for (const key of Object.keys(ord)) {
        let av: any;
        let bv: any;
        let dir: string;
        if (["_count", "_sum", "_avg", "_min", "_max"].includes(key)) {
          const sub = ord[key];
          const field = Object.keys(sub)[0];
          dir = sub[field];
          av = a[key]?.[field];
          bv = b[key]?.[field];
        } else {
          dir = ord[key];
          av = a[key];
          bv = b[key];
        }
        if (av < bv) return dir === "desc" ? 1 : -1;
        if (av > bv) return dir === "desc" ? -1 : 1;
      }
    }
    return 0;
  });
}

function buildGroupByResult(arr: Row[], args: any): Row[] {
  const byFields: string[] = Array.isArray(args.by) ? args.by : [args.by];
  const groups = new Map<string, Row[]>();
  for (const row of arr) {
    const key = byFields.map((f) => String(row[f])).join(String.fromCharCode(0));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  let results: Row[] = [];
  for (const groupRows of groups.values()) {
    const base: Row = {};
    for (const f of byFields) base[f] = groupRows[0][f];
    results.push({ ...base, ...buildAggregateResult(groupRows, args) });
  }
  if (args.orderBy) results = applyGroupOrderBy(results, args.orderBy);
  if (args.skip) results = results.slice(args.skip);
  if (args.take !== undefined) results = results.slice(0, args.take);
  return results;
}

// ─── Relations ────────────────────────────────────────────────────────────

type RelationDef =
  | { type: "one"; model: string; localField: string }
  | { type: "many"; model: string; foreignField: string };

const RELATIONS: Record<string, Record<string, RelationDef>> = {
  user: {
    bets: { type: "many", model: "bet", foreignField: "userId" },
    transactions: { type: "many", model: "transaction", foreignField: "userId" },
    nfts: { type: "many", model: "nft", foreignField: "ownerId" },
  },
  bet: { user: { type: "one", model: "user", localField: "userId" } },
  transaction: { user: { type: "one", model: "user", localField: "userId" } },
  nft: { owner: { type: "one", model: "user", localField: "ownerId" } },
  friendship: {
    user: { type: "one", model: "user", localField: "userId" },
    friend: { type: "one", model: "user", localField: "friendId" },
  },
  friendRequest: {
    from: { type: "one", model: "user", localField: "fromId" },
    to: { type: "one", model: "user", localField: "toId" },
  },
  tradeOffer: {
    from: { type: "one", model: "user", localField: "fromId" },
    to: { type: "one", model: "user", localField: "toId" },
    items: { type: "many", model: "tradeOfferItem", foreignField: "tradeOfferId" },
  },
  tradeOfferItem: {
    nft: { type: "one", model: "nft", localField: "nftId" },
    tradeOffer: { type: "one", model: "tradeOffer", localField: "tradeOfferId" },
  },
  event: { participants: { type: "many", model: "eventParticipant", foreignField: "eventId" } },
  eventParticipant: { event: { type: "one", model: "event", localField: "eventId" } },
  promoCode: { redemptions: { type: "many", model: "promoRedemption", foreignField: "promoCodeId" } },
  promoRedemption: { promoCode: { type: "one", model: "promoCode", localField: "promoCodeId" } },
};

function resolveCount(db: MemoryDb, modelName: string, row: Row, spec: any): Row {
  const result: Row = {};
  const fields = spec?.select ? Object.keys(spec.select) : Object.keys(RELATIONS[modelName] ?? {});
  for (const field of fields) {
    const rel = RELATIONS[modelName]?.[field];
    if (!rel || rel.type !== "many") continue;
    const target = db.collection(rel.model);
    result[field] = Array.from(target.rows.values()).filter((r) => r[rel.foreignField] === row.id).length;
  }
  return result;
}

function resolveRelation(db: MemoryDb, rel: RelationDef, row: Row, nestedArgs: any): any {
  const target = db.collection(rel.model);
  if (rel.type === "one") {
    const fk = row[rel.localField];
    if (fk === undefined || fk === null) return null;
    const found = target.rows.get(fk);
    return found ? applySelectAndInclude(db, rel.model, { ...found }, nestedArgs) : null;
  }
  return Array.from(target.rows.values())
    .filter((r) => r[rel.foreignField] === row.id)
    .map((r) => applySelectAndInclude(db, rel.model, { ...r }, nestedArgs));
}

function applySelectAndInclude(db: MemoryDb, modelName: string, row: Row, args: any): Row {
  if (!args) return row;
  if (args.select) {
    const result: Row = {};
    for (const key of Object.keys(args.select)) {
      const spec = args.select[key];
      if (!spec) continue;
      if (key === "_count") {
        result._count = resolveCount(db, modelName, row, spec);
        continue;
      }
      const rel = RELATIONS[modelName]?.[key];
      if (rel) {
        result[key] = resolveRelation(db, rel, row, spec === true ? {} : spec);
      } else {
        result[key] = row[key];
      }
    }
    return result;
  }
  const result = { ...row };
  if (args.include) {
    for (const key of Object.keys(args.include)) {
      const spec = args.include[key];
      if (!spec) continue;
      if (key === "_count") {
        result._count = resolveCount(db, modelName, row, spec);
        continue;
      }
      const rel = RELATIONS[modelName]?.[key];
      if (rel) {
        result[key] = resolveRelation(db, rel, row, spec === true ? {} : spec);
      }
    }
  }
  return result;
}

// ─── Collection ───────────────────────────────────────────────────────────

interface ModelConfig {
  idField: string;
  autoId: boolean;
  defaults: () => Row;
  uniqueFields?: string[];
  compoundKeys?: Record<string, string[]>;
  dateFields?: string[];
  updatedAtFields?: string[];
}

class Collection {
  name: string;
  config: ModelConfig;
  rows: Map<string, Row> = new Map();
  db!: MemoryDb;

  constructor(name: string, config: ModelConfig) {
    this.name = name;
    this.config = config;
  }

  snapshot() {
    return new Map(this.rows);
  }

  restore(snap: Map<string, Row>) {
    this.rows = new Map(snap);
  }

  private genId(): string {
    return "c" + crypto.randomBytes(12).toString("hex");
  }

  private touchUpdatedAt(row: Row) {
    for (const f of this.config.updatedAtFields ?? []) row[f] = new Date();
  }

  private coerceDates(row: Row) {
    for (const f of this.config.dateFields ?? []) {
      if (row[f] !== undefined && row[f] !== null && !(row[f] instanceof Date)) row[f] = new Date(row[f]);
    }
  }

  private checkUnique(row: Row, excludeId?: string) {
    for (const f of this.config.uniqueFields ?? []) {
      if (row[f] === undefined) continue;
      for (const [id, r] of this.rows) {
        if (id === excludeId) continue;
        if (r[f] === row[f]) throw new UniqueConstraintError([f]);
      }
    }
    for (const fields of Object.values(this.config.compoundKeys ?? {})) {
      if (fields.some((f) => row[f] === undefined)) continue;
      for (const [id, r] of this.rows) {
        if (id === excludeId) continue;
        if (fields.every((f) => r[f] === row[f])) throw new UniqueConstraintError(fields);
      }
    }
  }

  private all(): Row[] {
    return Array.from(this.rows.values()).map((r) => ({ ...r }));
  }

  private resolve(row: Row, args: any): Row {
    return applySelectAndInclude(this.db, this.name, row, args);
  }

  private lookupUnique(where: Row): Row | null {
    if (!where) return null;
    if (where[this.config.idField] !== undefined) {
      return this.rows.get(where[this.config.idField]) ?? null;
    }
    for (const f of this.config.uniqueFields ?? []) {
      if (where[f] !== undefined) {
        for (const r of this.rows.values()) if (r[f] === where[f]) return r;
        return null;
      }
    }
    for (const [keyName, fields] of Object.entries(this.config.compoundKeys ?? {})) {
      if (where[keyName] !== undefined) {
        const val = where[keyName];
        for (const r of this.rows.values()) if (fields.every((f) => r[f] === val[f])) return r;
        return null;
      }
    }
    return null;
  }

  create(args: { data: Row; select?: any; include?: any }): Row {
    const dataCopy: Row = { ...args.data };
    const nestedWrites: Array<{ rel: RelationDef & { type: "many" }; items: Row[] }> = [];
    for (const key of Object.keys(dataCopy)) {
      const rel = RELATIONS[this.name]?.[key];
      const val = dataCopy[key];
      if (rel && rel.type === "many" && val && typeof val === "object" && "create" in val) {
        nestedWrites.push({ rel, items: val.create });
        delete dataCopy[key];
      }
    }
    const row: Row = { ...this.config.defaults(), ...dataCopy };
    if (this.config.autoId && row[this.config.idField] === undefined) row[this.config.idField] = this.genId();
    this.coerceDates(row);
    this.checkUnique(row);
    this.rows.set(row[this.config.idField], row);

    for (const nw of nestedWrites) {
      const target = this.db.collection(nw.rel.model);
      for (const item of nw.items) {
        target.create({ data: { ...item, [nw.rel.foreignField]: row[this.config.idField] } });
      }
    }
    return this.resolve({ ...row }, args);
  }

  createMany(args: { data: Row[] }): { count: number } {
    for (const d of args.data) this.create({ data: d });
    return { count: args.data.length };
  }

  findUnique(args: any): Row | null {
    const row = this.lookupUnique(args.where);
    return row ? this.resolve({ ...row }, args) : null;
  }

  findUniqueOrThrow(args: any): Row {
    const row = this.findUnique(args);
    if (!row) throw new NotFoundError(`No ${this.name} found`);
    return row;
  }

  findFirst(args: any = {}): Row | null {
    const arr = this.findMany(args);
    return arr[0] ?? null;
  }

  findMany(args: any = {}): Row[] {
    let arr = this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys));
    if (args.orderBy) arr = applyOrderBy(arr, args.orderBy);
    if (args.skip) arr = arr.slice(args.skip);
    if (args.take !== undefined) arr = arr.slice(0, args.take);
    return arr.map((r) => this.resolve(r, args));
  }

  count(args: any = {}): number {
    return this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys)).length;
  }

  update(args: any): Row {
    const existing = this.lookupUnique(args.where);
    if (!existing) throw new NotFoundError(`No ${this.name} found to update`);
    const next = applyUpdateData(existing, args.data);
    this.touchUpdatedAt(next);
    this.coerceDates(next);
    this.checkUnique(next, existing[this.config.idField]);
    this.rows.set(existing[this.config.idField], next);
    return this.resolve({ ...next }, args);
  }

  updateMany(args: any = {}): { count: number } {
    const targets = this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys));
    for (const t of targets) {
      const next = applyUpdateData(t, args.data);
      this.touchUpdatedAt(next);
      this.coerceDates(next);
      this.rows.set(t[this.config.idField], next);
    }
    return { count: targets.length };
  }

  upsert(args: any): Row {
    const existing = this.lookupUnique(args.where);
    if (existing) return this.update({ where: args.where, data: args.update, select: args.select, include: args.include });
    return this.create({ data: args.create, select: args.select, include: args.include });
  }

  delete(args: any): Row {
    const existing = this.lookupUnique(args.where);
    if (!existing) throw new NotFoundError(`No ${this.name} found to delete`);
    this.rows.delete(existing[this.config.idField]);
    return { ...existing };
  }

  deleteMany(args: any = {}): { count: number } {
    const targets = this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys));
    for (const t of targets) this.rows.delete(t[this.config.idField]);
    return { count: targets.length };
  }

  aggregate(args: any = {}): Row {
    const arr = this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys));
    return buildAggregateResult(arr, args);
  }

  groupBy(args: any): Row[] {
    const arr = this.all().filter((r) => matchWhere(r, args.where, this.config.compoundKeys));
    return buildGroupByResult(arr, args);
  }
}

// ─── MemoryDb registry ────────────────────────────────────────────────────

class MemoryDb {
  collections = new Map<string, Collection>();

  register(name: string, config: ModelConfig) {
    const c = new Collection(name, config);
    c.db = this;
    this.collections.set(name, c);
  }

  collection(name: string): Collection {
    const c = this.collections.get(name);
    if (!c) throw new Error(`Unknown model: ${name}`);
    return c;
  }
}

const now = () => new Date();

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  user: {
    idField: "id",
    autoId: true,
    defaults: () => ({
      balance: 100000,
      bank: 0,
      level: 1,
      xp: 0,
      createdAt: now(),
      clientSeed: "default-client-seed",
      nonce: 0,
      isBanned: false,
      rank: "newcomer",
      emailVerified: false,
      isApproved: true,
      isAdmin: false,
      flagged: false,
    }),
    uniqueFields: ["username", "email"],
    dateFields: ["createdAt", "emailTokenExpiry", "approvedUntil", "flaggedAt"],
  },
  seedRotation: {
    idField: "id",
    autoId: true,
    defaults: () => ({ rotatedAt: now() }),
    dateFields: ["rotatedAt"],
  },
  bet: {
    idField: "id",
    autoId: true,
    defaults: () => ({ createdAt: now() }),
    dateFields: ["createdAt"],
  },
  transaction: {
    idField: "id",
    autoId: true,
    defaults: () => ({ createdAt: now() }),
    dateFields: ["createdAt"],
  },
  rakebackClaim: {
    idField: "id",
    autoId: true,
    defaults: () => ({ createdAt: now() }),
    dateFields: ["createdAt"],
  },
  friendRequest: {
    idField: "id",
    autoId: true,
    defaults: () => ({ status: "pending", createdAt: now() }),
    compoundKeys: { fromId_toId: ["fromId", "toId"] },
    dateFields: ["createdAt"],
  },
  friendship: {
    idField: "id",
    autoId: true,
    defaults: () => ({ createdAt: now() }),
    compoundKeys: { userId_friendId: ["userId", "friendId"] },
    dateFields: ["createdAt"],
  },
  crashRound: {
    idField: "id",
    autoId: true,
    defaults: () => ({ startedAt: now() }),
    uniqueFields: ["roundNumber"],
    dateFields: ["startedAt", "endedAt"],
  },
  houseBank: {
    idField: "id",
    autoId: false,
    defaults: () => ({ chips: 1000000000, dollars: 1000000000, updatedAt: now() }),
    updatedAtFields: ["updatedAt"],
    dateFields: ["updatedAt"],
  },
  houseBankTransaction: {
    idField: "id",
    autoId: true,
    defaults: () => ({ chipsChange: 0, dollarsChange: 0, createdAt: now() }),
    dateFields: ["createdAt"],
  },
  nft: {
    idField: "id",
    autoId: true,
    defaults: () => ({ mintedAt: now() }),
    dateFields: ["mintedAt"],
  },
  tradeOffer: {
    idField: "id",
    autoId: true,
    defaults: () => ({ offeredChips: 0, requestedChips: 0, status: "pending", createdAt: now(), updatedAt: now() }),
    updatedAtFields: ["updatedAt"],
    dateFields: ["createdAt", "updatedAt"],
  },
  tradeOfferItem: {
    idField: "id",
    autoId: true,
    defaults: () => ({}),
  },
  jackpotRound: {
    idField: "id",
    autoId: true,
    defaults: () => ({ status: "open", totalPot: 0, entries: "[]", createdAt: now() }),
    dateFields: ["createdAt", "closedAt"],
  },
  siteConfig: {
    idField: "key",
    autoId: false,
    defaults: () => ({ updatedAt: now() }),
    updatedAtFields: ["updatedAt"],
    dateFields: ["updatedAt"],
  },
  nftSupply: {
    idField: "templateId",
    autoId: false,
    defaults: () => ({ minted: 0 }),
  },
  activeBuff: {
    idField: "id",
    autoId: true,
    defaults: () => ({ value: 1.0, betsLeft: 0, createdAt: now() }),
    dateFields: ["createdAt", "expiresAt"],
  },
  promoCode: {
    idField: "id",
    autoId: true,
    defaults: () => ({ maxUses: 1, uses: 0, active: true, createdAt: now() }),
    uniqueFields: ["code"],
    dateFields: ["createdAt", "expiresAt"],
  },
  promoRedemption: {
    idField: "id",
    autoId: true,
    defaults: () => ({ redeemedAt: now() }),
    compoundKeys: { promoCodeId_userId: ["promoCodeId", "userId"] },
    dateFields: ["redeemedAt"],
  },
  broadcast: {
    idField: "id",
    autoId: true,
    defaults: () => ({ type: "info", active: true, createdAt: now() }),
    dateFields: ["createdAt"],
  },
  report: {
    idField: "id",
    autoId: true,
    defaults: () => ({ status: "open", context: null, createdAt: now() }),
    dateFields: ["createdAt"],
  },
  caseOpening: {
    idField: "id",
    autoId: true,
    defaults: () => ({ createdAt: now() }),
    dateFields: ["createdAt"],
  },
  anticheatEvent: {
    idField: "id",
    autoId: true,
    defaults: () => ({ details: "{}", resolved: false, createdAt: now() }),
    dateFields: ["createdAt", "resolvedAt"],
  },
  nftListing: {
    idField: "id",
    autoId: true,
    defaults: () => ({ status: "active", createdAt: now() }),
    uniqueFields: ["nftId"],
    dateFields: ["createdAt", "soldAt"],
  },
  event: {
    idField: "id",
    autoId: true,
    defaults: () => ({
      description: "",
      entryFee: 0,
      maxPlayers: 50,
      hostCutPct: 5,
      prizePool: 0,
      hostEarned: 0,
      status: "open",
      createdAt: now(),
    }),
    dateFields: ["createdAt", "completedAt"],
  },
  eventParticipant: {
    idField: "id",
    autoId: true,
    defaults: () => ({ joinedAt: now() }),
    compoundKeys: { eventId_userId: ["eventId", "userId"] },
    dateFields: ["joinedAt"],
  },
  boardGameRoom: {
    idField: "id",
    autoId: true,
    defaults: () => ({ status: "waiting", maxPlayers: 2, players: "[]", state: "{}", createdAt: now(), updatedAt: now() }),
    updatedAtFields: ["updatedAt"],
    dateFields: ["createdAt", "updatedAt"],
  },
};

const memoryDb = new MemoryDb();
for (const [name, config] of Object.entries(MODEL_CONFIGS)) memoryDb.register(name, config);

// ─── Disk persistence ─────────────────────────────────────────────────────
// The store lives in RAM, so without this every restart/redeploy would wipe
// all accounts, balances, and config. We snapshot every collection to a single
// JSON file and reload it on boot. Point DATA_FILE at a PERSISTENT disk (e.g. a
// Railway Volume mounted at /data → DATA_FILE=/data/db.json) so the data also
// survives redeploys, not just in-process restarts. See DATABASE_SETUP.md.
const DATA_FILE = process.env.DATA_FILE || process.env.DB_FILE || path.join(process.cwd(), "data", "db.json");
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite = false;

function reviveDates(modelName: string, row: Row): Row {
  const cfg = MODEL_CONFIGS[modelName];
  if (cfg?.dateFields) {
    for (const f of cfg.dateFields) {
      if (typeof row[f] === "string") row[f] = new Date(row[f]);
    }
  }
  return row;
}

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) return;
    const data = JSON.parse(raw) as Record<string, Row[]>;
    for (const [name, rows] of Object.entries(data)) {
      const col = memoryDb.collections.get(name);
      if (!col || !Array.isArray(rows)) continue;
      const map = new Map<string, Row>();
      const idField = col.config.idField;
      for (const row of rows) map.set(row[idField], reviveDates(name, row));
      col.restore(map);
    }
    console.log(`💾 Restored database from ${DATA_FILE}`);
  } catch (err) {
    console.error("Failed to load database from disk (starting empty):", err);
  }
}

function persistNow(): void {
  try {
    const out: Record<string, Row[]> = {};
    for (const [name, col] of memoryDb.collections) out[name] = [...col.snapshot().values()];
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out), "utf8");
    fs.renameSync(tmp, DATA_FILE); // atomic swap so a crash mid-write can't corrupt it
    pendingWrite = false;
  } catch (err) {
    console.error("Failed to persist database to disk:", err);
  }
}

/** Debounced save — coalesces bursts of writes into one disk flush. */
function schedulePersist(): void {
  pendingWrite = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, 800);
}

loadFromDisk();

// Safety net + clean shutdown flush (Railway sends SIGTERM on redeploy).
setInterval(() => { if (pendingWrite) persistNow(); }, 15_000).unref?.();
for (const sig of ["SIGTERM", "SIGINT", "beforeExit"] as const) {
  process.on(sig, () => { persistNow(); });
}

// ─── Lazy "PrismaPromise"-like wrapper ────────────────────────────────────
// Building a `prisma.model.method(...)` call must NOT execute immediately —
// `$transaction([...])` relies on collecting these calls into an array
// before any of them run, then executing them in order itself.

class LazyOp<T> implements PromiseLike<T> {
  constructor(private exec: () => T) {}

  __exec(): T {
    return this.exec();
  }

  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return Promise.resolve().then(() => this.exec()).then(onfulfilled as any, onrejected as any);
  }

  catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.then(undefined, onrejected as any) as Promise<T | R>;
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.then(
      (v) => {
        onfinally?.();
        return v;
      },
      (e) => {
        onfinally?.();
        throw e;
      }
    );
  }
}

function wrapCollection(collection: Collection): any {
  // Mutating ops trigger a debounced save so changes reach disk.
  const mut = (fn: () => any) => new LazyOp(() => { const r = fn(); schedulePersist(); return r; });
  return {
    create: (args: any) => mut(() => collection.create(args)),
    createMany: (args: any) => mut(() => collection.createMany(args)),
    findUnique: (args: any) => new LazyOp(() => collection.findUnique(args)),
    findUniqueOrThrow: (args: any) => new LazyOp(() => collection.findUniqueOrThrow(args)),
    findFirst: (args?: any) => new LazyOp(() => collection.findFirst(args)),
    findMany: (args?: any) => new LazyOp(() => collection.findMany(args)),
    count: (args?: any) => new LazyOp(() => collection.count(args)),
    update: (args: any) => mut(() => collection.update(args)),
    updateMany: (args: any) => mut(() => collection.updateMany(args)),
    upsert: (args: any) => mut(() => collection.upsert(args)),
    delete: (args: any) => mut(() => collection.delete(args)),
    deleteMany: (args?: any) => mut(() => collection.deleteMany(args)),
    aggregate: (args?: any) => new LazyOp(() => collection.aggregate(args)),
    groupBy: (args: any) => new LazyOp(() => collection.groupBy(args)),
  };
}

async function runInTransaction<T>(fn: () => Promise<T> | T): Promise<T> {
  const snapshots = new Map<string, Map<string, Row>>();
  for (const [name, col] of memoryDb.collections) snapshots.set(name, col.snapshot());
  try {
    return await fn();
  } catch (err) {
    for (const [name, col] of memoryDb.collections) col.restore(snapshots.get(name)!);
    throw err;
  }
}

const prismaClient: any = {};

for (const [name, col] of memoryDb.collections) {
  prismaClient[name] = wrapCollection(col);
}

prismaClient.$connect = async () => {};
prismaClient.$disconnect = async () => {};
prismaClient.$queryRaw = async (..._args: any[]) => [{ "1": 1 }];

prismaClient.$transaction = async (arg: any) => {
  if (typeof arg === "function") {
    return runInTransaction(() => arg(prismaClient));
  }
  return runInTransaction(async () => {
    const results: any[] = [];
    for (const op of arg) {
      results.push(await op.__exec());
    }
    return results;
  });
};

export const prisma = prismaClient;
