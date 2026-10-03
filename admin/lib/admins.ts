// 管理端账号：data/admins.json 文件存储 + scrypt 密码哈希 + 登录失败锁定
// 注意：锁定计数在内存中，进程重启即清零
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AdminRole = 'readonly' | 'ops' | 'super';

export interface AdminAccount {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  last_login_at?: string;
}

const ADMINS_FILE = path.join(process.cwd(), 'data', 'admins.json');
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

/** 密码哈希：自描述格式 scrypt:N:r:p:saltHex:hashHex */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** 校验密码（timingSafeEqual 防侧信道） */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const expect = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expect.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return got.length === expect.length && crypto.timingSafeEqual(got, expect);
  } catch {
    return false;
  }
}

// 账号列表缓存挂 globalThis，与 store.ts 同理避免模块拆分不共享
const globalKey = '__srd_admin_accounts__';
const g = globalThis as unknown as Record<string, AdminAccount[] | undefined>;

function persist(accounts: AdminAccount[]): void {
  fs.mkdirSync(path.dirname(ADMINS_FILE), { recursive: true });
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(accounts, null, 2));
}

/** 首次启动无 admins.json 时引导创建超管 */
function bootstrap(): AdminAccount[] {
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;
  const email = envEmail || 'admin';
  // 生产环境必须通过 ADMIN_EMAIL / ADMIN_PASSWORD 覆盖默认账号！
  const password = envPassword || 'admin123';
  const account: AdminAccount = {
    id: crypto.randomUUID(),
    email,
    password_hash: hashPassword(password),
    role: 'super',
  };
  persist([account]);
  if (!envEmail || !envPassword) {
    console.warn(
      '\n⚠️⚠️⚠️  [admin] 已创建默认超管账号 admin / admin123 —— 生产环境必须立即改密，' +
        '或配置 ADMIN_EMAIL / ADMIN_PASSWORD 环境变量后删除 data/admins.json 重启重建！ ⚠️⚠️⚠️\n',
    );
  } else {
    console.warn('[admin] 已通过 ADMIN_EMAIL 环境变量初始化超管账号');
  }
  return [account];
}

function accounts(): AdminAccount[] {
  if (!g[globalKey]) {
    let list: AdminAccount[] | null = null;
    try {
      list = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8')) as AdminAccount[];
    } catch {
      /* 文件不存在或损坏 */
    }
    g[globalKey] = list && list.length > 0 ? list : bootstrap();
  }
  return g[globalKey]!;
}

export function findAdmin(email: string): AdminAccount | undefined {
  return accounts().find((a) => a.email === email);
}

export function touchLastLogin(email: string): void {
  const list = accounts();
  const account = list.find((a) => a.email === email);
  if (!account) return;
  account.last_login_at = new Date().toISOString();
  persist(list);
}

/* ---------- 登录失败锁定（连续 5 次失败锁 15 分钟，内存实现、重启清零） ---------- */

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface LockEntry {
  fails: number;
  lockedUntil: number;
}

const lockKey = '__srd_admin_lockout__';
const lg = globalThis as unknown as Record<string, Map<string, LockEntry> | undefined>;

function lockMap(): Map<string, LockEntry> {
  if (!lg[lockKey]) lg[lockKey] = new Map();
  return lg[lockKey]!;
}

/** 当前是否锁定中；返回剩余分钟数，0 表示未锁定 */
export function lockRemainingMin(email: string): number {
  const e = lockMap().get(email);
  if (e && e.lockedUntil > Date.now()) return Math.ceil((e.lockedUntil - Date.now()) / 60000);
  return 0;
}

/** 记录一次登录失败；返回触发锁定后的剩余分钟数（未触发为 0） */
export function recordLoginFail(email: string): number {
  const now = Date.now();
  const map = lockMap();
  let e = map.get(email);
  if (!e || (e.lockedUntil > 0 && e.lockedUntil <= now)) e = { fails: 0, lockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= MAX_FAILS) {
    e.lockedUntil = now + LOCK_MS;
    e.fails = 0;
    map.set(email, e);
    return Math.ceil(LOCK_MS / 60000);
  }
  map.set(email, e);
  return 0;
}

export function clearLoginFails(email: string): void {
  lockMap().delete(email);
}
