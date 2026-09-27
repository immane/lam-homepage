const DATABASE = "lam-guest-files";
const STORE = "archives";
const ROOT_ARCHIVE_KEY = "root-files-v2";

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function readGuestFiles(): Promise<Uint8Array | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;
  return new Promise((resolve) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(ROOT_ARCHIVE_KEY);
    request.onsuccess = () => {
      const value: unknown = request.result;
      database.close();
      resolve(value instanceof ArrayBuffer ? new Uint8Array(value) : undefined);
    };
    request.onerror = () => {
      database.close();
      resolve(undefined);
    };
  });
}

export async function writeGuestFiles(files: Uint8Array): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(files.slice().buffer, ROOT_ARCHIVE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      resolve();
    };
  });
}
