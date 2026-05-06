export const PACKET_LENGTH = 16;
export const PAYLOAD_LENGTH = 14;

// IMPORTANT — Urion watches advertise with the 16-bit SIG short UUID
// 0x0000FEE7 (expanded to the 128-bit form below). The custom 6E40FFF0-…
// UUID quoted in docs/06-ble-protocol.md §1 is the GATT *service* UUID
// the watch exposes AFTER connect; it does not appear in the
// advertising packet. Scan filter must use the advertising UUID, GATT
// reads/writes use the service UUID. Confirmed against U19M_013C
// 2026-05-06; doc still needs an update.
export const URION_ADVERTISING_SERVICE_UUID =
  '0000fee7-0000-1000-8000-00805f9b34fb';
export const URION_GATT_SERVICE_UUID = '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E';
export const URION_WRITE_CHAR_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
export const URION_NOTIFY_CHAR_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

/** @deprecated use URION_GATT_SERVICE_UUID for GATT or
 * URION_ADVERTISING_SERVICE_UUID for scan filters. */
export const URION_SERVICE_UUID = URION_GATT_SERVICE_UUID;

export function crc8(bytes: Uint8Array, end: number = bytes.length): number {
  let sum = 0;
  for (let i = 0; i < end; i++) sum = (sum + bytes[i]) & 0xff;
  return sum;
}

export function buildPacket(
  command: number,
  payload?: Uint8Array | readonly number[],
): Uint8Array {
  if (!Number.isInteger(command) || command < 0 || command > 0xff) {
    throw new RangeError(`command out of range: ${command}`);
  }
  const packet = new Uint8Array(PACKET_LENGTH);
  packet[0] = command;
  if (payload) {
    const data = payload instanceof Uint8Array ? payload : Uint8Array.from(payload);
    if (data.length > PAYLOAD_LENGTH) {
      throw new RangeError(
        `payload too long: ${data.length} bytes (max ${PAYLOAD_LENGTH})`,
      );
    }
    packet.set(data, 1);
  }
  packet[PACKET_LENGTH - 1] = crc8(packet, PACKET_LENGTH - 1);
  return packet;
}

export type ParsedPacket = { command: number; payload: Uint8Array };

export class CrcError extends Error {
  readonly received: number;
  readonly expected: number;
  constructor(received: number, expected: number) {
    super(`CRC8 mismatch (received 0x${received.toString(16)}, expected 0x${expected.toString(16)})`);
    this.name = 'CrcError';
    this.received = received;
    this.expected = expected;
  }
}

export function parsePacket(bytes: Uint8Array): ParsedPacket {
  if (bytes.length !== PACKET_LENGTH) {
    throw new RangeError(
      `expected ${PACKET_LENGTH}-byte packet, got ${bytes.length}`,
    );
  }
  const expected = crc8(bytes, PACKET_LENGTH - 1);
  const received = bytes[PACKET_LENGTH - 1];
  if (received !== expected) throw new CrcError(received, expected);
  return {
    command: bytes[0],
    payload: bytes.slice(1, PACKET_LENGTH - 1),
  };
}

export type ResponseValidator = (parsed: ParsedPacket) => boolean;

export function expectByte0(expected: number): ResponseValidator {
  return ({ command }) => command === expected;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}
