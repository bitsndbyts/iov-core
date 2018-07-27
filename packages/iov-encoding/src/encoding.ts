import * as base64js from "base64-js";

export class Encoding {
  public static toHex(data: Uint8Array): string {
    // tslint:disable-next-line:no-let
    let out: string = "";
    for (const byte of data) {
      out += ("0" + byte.toString(16)).slice(-2);
    }
    return out;
  }

  public static fromHex(hexstring: string): Uint8Array {
    if (hexstring.length % 2 !== 0) {
      throw new Error("hex string length must be a multiple of 2");
    }

    // tslint:disable-next-line:readonly-array
    const listOfInts: number[] = [];
    // tslint:disable-next-line:no-let
    for (let i = 0; i < hexstring.length; i += 2) {
      const hexByteAsString = hexstring.substr(i, 2);
      if (!hexByteAsString.match(/[0-9a-f]{2}/i)) {
        throw new Error("hex string contains invalid characters");
      }
      listOfInts.push(parseInt(hexByteAsString, 16));
    }
    return new Uint8Array(listOfInts);
  }

  public static toBase64(data: Uint8Array): string {
    return base64js.fromByteArray(data);
  }

  public static fromBase64(base64String: string): Uint8Array {
    if (!base64String.match(/^[a-zA-Z0-9+/]*={0,2}$/)) {
      throw new Error("Invalid base64 string format");
    }
    return base64js.toByteArray(base64String);
  }

  public static toAscii(input: string): Uint8Array {
    const toNums = (str: string) =>
      str.split("").map((x: string) => {
        const charCode = x.charCodeAt(0);
        // 0x00–0x1F control characters
        // 0x20–0x7E printable characters
        // 0x7F delete character
        // 0x80–0xFF out of 7 bit ascii range
        if (charCode < 0x20 || charCode > 0x7e) {
          throw new Error("Cannot encode character that is out of printable ASCII range: " + charCode);
        }
        return charCode;
      });
    return Uint8Array.from(toNums(input));
  }

  public static fromAscii(data: Uint8Array): string {
    const fromNums = (listOfNumbers: ReadonlyArray<number>) =>
      listOfNumbers.map(
        (x: number): string => {
          // 0x00–0x1F control characters
          // 0x20–0x7E printable characters
          // 0x7F delete character
          // 0x80–0xFF out of 7 bit ascii range
          if (x < 0x20 || x > 0x7e) {
            throw new Error("Cannot decode character that is out of printable ASCII range: " + x);
          }
          return String.fromCharCode(x);
        },
      );

    return fromNums(Array.from(data)).join("");
  }

  public static toUtf8(str: string): Uint8Array {
    // Browser and future nodejs (https://github.com/nodejs/node/issues/20365)
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(str);
    }

    // Use Buffer hack instead of nodejs util.TextEncoder to ensure
    // webpack does not bundle the util module for browsers.
    return new Uint8Array(Buffer.from(str, "utf8"));
  }

  public static fromUtf8(data: Uint8Array): string {
    // Browser and future nodejs (https://github.com/nodejs/node/issues/20365)
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: true }).decode(data);
    }

    // Use Buffer hack instead of nodejs util.TextDecoder to ensure
    // webpack does not bundle the util module for browsers.
    // Buffer.toString has no fatal option
    if (!Encoding.isValidUtf8(data)) {
      throw new Error("Invalid UTF8 data");
    }
    return Buffer.from(data).toString("utf8");
  }

  private static isValidUtf8(data: Uint8Array): boolean {
    const toStringAndBack = Buffer.from(Buffer.from(data).toString("utf8"), "utf8");
    return Buffer.compare(data, toStringAndBack) === 0;
  }
}
