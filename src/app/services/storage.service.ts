import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

/**
 * Service for handling app storage operations
 * 
 * This service provides a wrapper around Ionic Storage to make it easier to use
 * and provides consistent error handling and promise-based interface.
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private initialized = false;

  constructor(private storage: Storage) {
    this.init();
  }

  /**
   * Initialize the storage
   */
  async init() {
    if (this.initialized) {
      return;
    }
    
    try {
      const storage = await this.storage.create();
      this._storage = storage;
      this.initialized = true;
      console.log('Storage initialized successfully');
    } catch (error) {
      console.error('Error initializing storage', error);
    }
  }

  /**
   * Store a value with the given key
   * @param key The key to store the value under
   * @param value The value to store
   * @returns A promise that resolves when the value is stored
   */
  async set(key: string, value: any): Promise<void> {
    await this.ensureInitialized();
    return this._storage?.set(key, value);
  }

  /**
   * Get a value by key
   * @param key The key to retrieve
   * @returns A promise that resolves with the value or null if not found
   */
  async get(key: string): Promise<any> {
    await this.ensureInitialized();
    return this._storage?.get(key) || null;
  }

  /**
   * Remove a value by key
   * @param key The key to remove
   * @returns A promise that resolves when the value is removed
   */
  async remove(key: string): Promise<void> {
    await this.ensureInitialized();
    return this._storage?.remove(key);
  }

  /**
   * Clear all stored values
   * @returns A promise that resolves when all values are cleared
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    return this._storage?.clear();
  }

  /**
   * Get all keys in storage
   * @returns A promise that resolves with all keys
   */
  async keys(): Promise<string[]> {
    await this.ensureInitialized();
    return this._storage?.keys() || [];
  }

  /**
   * Check if storage has been initialized, initialize if not
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }
  }
}