import { Client } from '@replit/object-storage';
let client;
async function storage() {
  if (!client) {
    client = new Client(process.env.CERTIFICATE_BUCKET_ID ? { bucketId: process.env.CERTIFICATE_BUCKET_ID } : undefined);
    try { await client.getBucket(); } catch {
      client = undefined;
      throw Object.assign(new Error('Private certificate storage is not configured. Ask the site owner to create an App Storage bucket.'), { status: 503 });
    }
  }
  return client;
}
export async function putFile(key, buffer) {
  const result = await (await storage()).uploadFromBytes(key, buffer);
  if (!result.ok) throw Object.assign(new Error('Certificate storage is temporarily unavailable. Please retry.'), { status: 503 });
}
export async function getFile(key) {
  const result = await (await storage()).downloadAsBytes(key);
  if (!result.ok) throw Object.assign(new Error('Certificate file could not be retrieved.'), { status: 503 });
  // The SDK returns a one-element tuple, not the Buffer itself.
  return result.value[0];
}
export async function fileExists(key) {
  const result = await (await storage()).exists(key);
  if (!result.ok) throw Object.assign(new Error('Certificate storage could not be checked.'), { status: 503 });
  return result.value;
}
export async function deleteFile(key) {
  const result = await (await storage()).delete(key, { ignoreNotFound: true });
  if (!result.ok) throw Object.assign(new Error('Certificate file could not be deleted.'), { status: 503 });
}
