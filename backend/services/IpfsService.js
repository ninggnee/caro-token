/**
 * IpfsService — upload files to Infura IPFS.
 *
 * Requires env vars:
 *   INFURA_IPFS_PROJECT_ID
 *   INFURA_IPFS_SECRET
 *
 * If either var is missing the service runs in off-chain mode:
 * uploadToIPFS() returns null and callers store the file locally only.
 */

const INFURA_IPFS_ENDPOINT = 'https://ipfs.infura.io:5001/api/v0/add?pin=true';

/**
 * Upload a file buffer to Infura IPFS.
 *
 * @param {Buffer} buffer      File content
 * @param {string} fileName    Original file name (used as IPFS path hint)
 * @param {string} [mimeType]  MIME type hint (default application/octet-stream)
 * @returns {Promise<string|null>} IPFS CID (v0 Qm…) or null if IPFS not configured
 */
export async function uploadToIPFS(buffer, fileName, mimeType = 'application/octet-stream') {
  const projectId = process.env.INFURA_IPFS_PROJECT_ID;
  const secret    = process.env.INFURA_IPFS_SECRET;

  if (!projectId || !secret) {
    return null; // off-chain mode
  }

  const auth = 'Basic ' + Buffer.from(`${projectId}:${secret}`).toString('base64');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);

  const response = await fetch(INFURA_IPFS_ENDPOINT, {
    method:  'POST',
    headers: { Authorization: auth },
    body:    form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`IPFS upload failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  return data.Hash; // CIDv0: Qm...
}
