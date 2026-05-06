import {
  CrcError,
  PACKET_LENGTH,
  base64ToBytes,
  buildPacket,
  bytesToBase64,
  crc8,
  expectByte0,
  parsePacket,
} from '../io';

describe('crc8', () => {
  it('returns 0 for an empty array', () => {
    expect(crc8(new Uint8Array(0))).toBe(0);
  });

  it('sums bytes mod 256', () => {
    expect(crc8(Uint8Array.from([1, 2, 3]))).toBe(6);
    expect(crc8(Uint8Array.from([0xff, 0x01]))).toBe(0);
    expect(crc8(Uint8Array.from([0x80, 0x80, 0x01]))).toBe(0x01);
  });

  it('honours the end index', () => {
    const bytes = Uint8Array.from([1, 2, 3, 99]);
    expect(crc8(bytes, 3)).toBe(6);
  });
});

describe('buildPacket', () => {
  it('produces a 16-byte packet', () => {
    const packet = buildPacket(0x14);
    expect(packet).toHaveLength(PACKET_LENGTH);
  });

  it('places command at byte 0 and zeros the payload', () => {
    const packet = buildPacket(0x14);
    expect(packet[0]).toBe(0x14);
    for (let i = 1; i < 15; i++) expect(packet[i]).toBe(0);
  });

  it('writes the payload starting at byte 1', () => {
    const packet = buildPacket(0x16, [0x02, 0x01]);
    expect(Array.from(packet.slice(0, 4))).toEqual([0x16, 0x02, 0x01, 0x00]);
  });

  it('appends a valid CRC8 at byte 15', () => {
    const packet = buildPacket(0x16, [0x02, 0x01]);
    expect(packet[PACKET_LENGTH - 1]).toBe(crc8(packet, PACKET_LENGTH - 1));
    expect(packet[PACKET_LENGTH - 1]).toBe((0x16 + 0x02 + 0x01) & 0xff);
  });

  it('accepts Uint8Array payloads', () => {
    const packet = buildPacket(0x01, Uint8Array.from([0xab, 0xcd]));
    expect(packet[0]).toBe(0x01);
    expect(packet[1]).toBe(0xab);
    expect(packet[2]).toBe(0xcd);
  });

  it('rejects out-of-range commands', () => {
    expect(() => buildPacket(-1)).toThrow(RangeError);
    expect(() => buildPacket(256)).toThrow(RangeError);
    expect(() => buildPacket(1.5)).toThrow(RangeError);
  });

  it('rejects payloads longer than 14 bytes', () => {
    expect(() => buildPacket(0x14, new Array(15).fill(0))).toThrow(RangeError);
  });
});

describe('parsePacket', () => {
  it('round-trips with buildPacket', () => {
    const packet = buildPacket(0x50, [0xde, 0xad, 0xbe, 0xef]);
    const parsed = parsePacket(packet);
    expect(parsed.command).toBe(0x50);
    expect(Array.from(parsed.payload)).toEqual([
      0xde, 0xad, 0xbe, 0xef,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('throws CrcError on a bad checksum', () => {
    const packet = buildPacket(0x14);
    packet[PACKET_LENGTH - 1] ^= 0xff;
    expect(() => parsePacket(packet)).toThrow(CrcError);
  });

  it('throws RangeError on wrong length', () => {
    expect(() => parsePacket(new Uint8Array(8))).toThrow(RangeError);
  });
});

describe('expectByte0', () => {
  it('matches by command byte', () => {
    const validator = expectByte0(0x16);
    expect(validator({ command: 0x16, payload: new Uint8Array() })).toBe(true);
    expect(validator({ command: 0x14, payload: new Uint8Array() })).toBe(false);
  });
});

describe('base64 helpers', () => {
  it('round-trips binary bytes', () => {
    const original = Uint8Array.from([0, 1, 254, 255, 16, 99]);
    const b64 = bytesToBase64(original);
    expect(base64ToBytes(b64)).toEqual(original);
  });

  it('round-trips a built packet (the BLE wire shape)', () => {
    const packet = buildPacket(0x01, [0xaa, 0xbb, 0xcc]);
    const b64 = bytesToBase64(packet);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(packet);
  });
});
