import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Stored format: scrypt$<cost>$<blockSize>$<parallelization>$<salt base64>$<hash base64>
// Keeping the parameters in the stored value lets us raise them later without breaking old passwords.
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 8;

function deriveKey(password: string, salt: Buffer, cost: number, blockSize: number, parallelization: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, cost, blockSize, parallelization, saltText, keyText] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltText || !keyText) return false;

  const expected = Buffer.from(keyText, 'base64');
  const actual = await deriveKey(password, Buffer.from(saltText, 'base64'), Number(cost), Number(blockSize), Number(parallelization));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
