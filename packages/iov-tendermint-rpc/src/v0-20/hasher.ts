import { Ripemd160 } from "@iov/crypto";
import { PostableBytes, TxId } from "@iov/tendermint-types";

// a bit ugly as this expects buffer, while the rest of code uint8array
export const hashTx = (tx: PostableBytes): TxId => {
  const hash = new Ripemd160()
    .update(prefix(tx))
    .update(tx)
    .digest();
  return hash as TxId;
};

// prefix will create a varint prefix for any number < 2^14
// should be a good enough estimation for tx hashing
const prefix = (tx: Uint8Array): Uint8Array => {
  const l = tx.length;
  if (l < 128) {
    return Uint8Array.from([l]);
  }
  const high = Math.floor(l / 128);
  const low = (l % 128) + 128;
  return Uint8Array.from([low, high]);
};
