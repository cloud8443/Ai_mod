import fs from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { AIProvider, StoredSecret } from '../src/lib/types/contracts.js';

type SecretRecord = Record<string, StoredSecret>;

export class LocalTokenStore {
  private filePath = path.join(app.getPath('userData'), 'secrets.enc.json');

  async get(provider: AIProvider): Promise<StoredSecret | null> {
    const all = await this.readAll();
    return all[provider] ?? null;
  }

  async set(provider: AIProvider, value: string): Promise<StoredSecret> {
    const all = await this.readAll();
    const now = Date.now();
    const record: StoredSecret = {
      value,
      createdAt: all[provider]?.createdAt ?? now,
      updatedAt: now
    };
    all[provider] = record;
    await this.writeAll(all);
    return record;
  }

  async clear(provider: AIProvider): Promise<void> {
    const all = await this.readAll();
    delete all[provider];
    await this.writeAll(all);
  }

  private async readAll(): Promise<SecretRecord> {
    try {
      const raw = await fs.readFile(this.filePath);
      const json = this.decrypt(raw);
      return JSON.parse(json) as SecretRecord;
    } catch {
      return {};
    }
  }

  private async writeAll(data: SecretRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const encrypted = this.encrypt(JSON.stringify(data));
    await fs.writeFile(this.filePath, encrypted);
  }

  private encrypt(text: string): Buffer {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(text, 'utf-8');
    }
    return safeStorage.encryptString(text);
  }

  private decrypt(buffer: Buffer): string {
    if (!safeStorage.isEncryptionAvailable()) {
      return buffer.toString('utf-8');
    }
    return safeStorage.decryptString(buffer);
  }
}
