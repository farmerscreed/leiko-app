// Typed wrapper around a connected react-native-ble-plx Device. One
// instance per active connection. Holds the Notify subscription, exposes
// a sendCommand primitive that writes a 16-byte packet and (optionally)
// awaits the matching response. Per docs/06-ble-protocol.md §3.

import type { Device, Subscription } from 'react-native-ble-plx';
import { logger } from '../analytics/logger';
import {
  CrcError,
  ParsedPacket,
  ResponseValidator,
  URION_NOTIFY_CHAR_UUID,
  URION_SERVICE_UUID,
  URION_WRITE_CHAR_UUID,
  base64ToBytes,
  buildPacket,
  bytesToBase64,
  parsePacket,
} from './io';

export type NotifyHandler = (packet: ParsedPacket) => void;

export class CommandTimeoutError extends Error {
  constructor(public readonly command: number, public readonly timeoutMs: number) {
    super(`Command 0x${command.toString(16)} timed out after ${timeoutMs}ms`);
    this.name = 'CommandTimeoutError';
  }
}

export class UrionDevice {
  readonly id: string;
  readonly name: string | null;
  private notifySub: Subscription | null = null;
  private listeners = new Set<NotifyHandler>();

  constructor(private readonly device: Device) {
    this.id = device.id;
    this.name = device.name ?? device.localName ?? null;
  }

  /** Last 4 hex chars of the MAC, lower-case, no separators. UI display. */
  get macSuffix(): string {
    return this.id.replace(/[^0-9a-f]/gi, '').slice(-4).toLowerCase();
  }

  async startNotify(): Promise<void> {
    if (this.notifySub) return;
    this.notifySub = this.device.monitorCharacteristicForService(
      URION_SERVICE_UUID,
      URION_NOTIFY_CHAR_UUID,
      (error, characteristic) => {
        if (error) {
          logger.track('ble_disconnected', { deviceId: this.id, reason: error.message });
          return;
        }
        const value = characteristic?.value;
        if (!value) return;
        try {
          const packet = parsePacket(base64ToBytes(value));
          for (const l of this.listeners) l(packet);
        } catch (e) {
          if (e instanceof CrcError) {
            logger.track('ble_crc_fail', { deviceId: this.id });
            return;
          }
          throw e;
        }
      },
    );
  }

  onNotify(handler: NotifyHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  async writePacket(packet: Uint8Array): Promise<void> {
    await this.device.writeCharacteristicWithoutResponseForService(
      URION_SERVICE_UUID,
      URION_WRITE_CHAR_UUID,
      bytesToBase64(packet),
    );
  }

  async sendCommand(
    command: number,
    payload?: Uint8Array | readonly number[],
    validator?: ResponseValidator,
    timeoutMs = 5_000,
  ): Promise<ParsedPacket | undefined> {
    const packet = buildPacket(command, payload);
    if (!validator) {
      await this.writePacket(packet);
      return undefined;
    }
    const response = this.awaitResponse(validator, command, timeoutMs);
    await this.writePacket(packet);
    return response;
  }

  private awaitResponse(
    validator: ResponseValidator,
    command: number,
    timeoutMs: number,
  ): Promise<ParsedPacket> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new CommandTimeoutError(command, timeoutMs));
      }, timeoutMs);
      const unsub = this.onNotify((packet) => {
        if (validator(packet)) {
          clearTimeout(timer);
          unsub();
          resolve(packet);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.notifySub?.remove();
    this.notifySub = null;
    this.listeners.clear();
    try {
      await this.device.cancelConnection();
    } catch {
      // already disconnected — fine
    }
  }
}
