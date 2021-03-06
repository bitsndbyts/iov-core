import axios from "axios";
import equal from "fast-deep-equal";
import { ReadonlyDate } from "readonly-date";
import { Stream } from "xstream";

import { ChainId, PostableBytes, TxId } from "@iov/base-types";
import {
  Address,
  BcpAccount,
  BcpAccountQuery,
  BcpAddressQuery,
  BcpBlockInfo,
  BcpConnection,
  BcpPubkeyQuery,
  BcpQueryEnvelope,
  BcpQueryTag,
  BcpTicker,
  BcpTransactionResponse,
  BcpTransactionState,
  BcpTxQuery,
  ConfirmedTransaction,
  dummyEnvelope,
  isAddressQuery,
  isPubkeyQuery,
  Nonce,
  TokenTicker,
} from "@iov/bcp-types";
import { Parse } from "@iov/dpos";
import { Encoding, Int53 } from "@iov/encoding";
import { DefaultValueProducer, ValueAndUpdates } from "@iov/stream";

import { constants } from "./constants";
import { liskCodec } from "./liskcodec";

const { fromAscii, toAscii, toUtf8 } = Encoding;

// poll every 3 seconds (block time 10s)
const transactionStatePollInterval = 3_000;

/**
 * Encodes the current date and time as a nonce
 */
export function generateNonce(): Nonce {
  const now = new ReadonlyDate(ReadonlyDate.now());
  return Parse.timeToNonce(now);
}

function checkAndNormalizeUrl(url: string): string {
  if (!url.match(/^https?:\/\/[-\.a-zA-Z0-9]+(:[0-9]+)?\/?$/)) {
    throw new Error(
      "Invalid API URL. Expected a base URL like https://testnet.lisk.io or http://123.123.132.132:8000/",
    );
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function loadChainId(baseUrl: string): Promise<ChainId> {
  const url = checkAndNormalizeUrl(baseUrl) + "/api/node/constants";
  const result = await axios.get(url);
  const responseBody = result.data;
  return responseBody.data.nethash;
}

export class LiskConnection implements BcpConnection {
  public static async establish(baseUrl: string): Promise<LiskConnection> {
    const chainId = await loadChainId(baseUrl);
    return new LiskConnection(baseUrl, chainId);
  }

  private readonly baseUrl: string;
  private readonly myChainId: ChainId;

  constructor(baseUrl: string, chainId: ChainId) {
    this.baseUrl = checkAndNormalizeUrl(baseUrl);

    if (!chainId.match(/^[a-f0-9]{64}$/)) {
      throw new Error("The chain ID must be a Lisk nethash, encoded as 64 lower-case hex characters.");
    }
    this.myChainId = chainId;
  }

  public disconnect(): void {
    // no-op
  }

  public chainId(): ChainId {
    return this.myChainId;
  }

  public async height(): Promise<number> {
    const url = this.baseUrl + "/api/node/status";
    const result = await axios.get(url);
    const responseBody = result.data;
    return responseBody.data.height;
  }

  public async postTx(bytes: PostableBytes): Promise<BcpTransactionResponse> {
    const transactionId = JSON.parse(Encoding.fromUtf8(bytes)).id as string;
    if (!transactionId.match(/^[0-9]+$/)) {
      throw new Error("Invalid transaction ID");
    }

    const response = await axios.post(this.baseUrl + "/api/transactions", bytes, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (typeof response.data.meta.status !== "boolean" || response.data.meta.status !== true) {
      throw new Error("Did not get meta.status: true");
    }

    let blockInfoInterval: any;
    let lastEventSent: BcpBlockInfo | undefined;
    const blockInfoProducer = new DefaultValueProducer<BcpBlockInfo>(
      {
        state: BcpTransactionState.Pending,
      },
      {
        onStarted: () => {
          blockInfoInterval = setInterval(async () => {
            const search = await this.searchTx({ hash: toAscii(transactionId) as TxId, tags: [] });
            if (search.length > 0) {
              const confirmedTransaction = search[0];
              const event: BcpBlockInfo = {
                state: BcpTransactionState.InBlock,
                height: confirmedTransaction.height,
                confirmations: confirmedTransaction.confirmations,
              };

              if (!equal(event, lastEventSent)) {
                blockInfoProducer.update(event);
                lastEventSent = event;
              }
            }
          }, transactionStatePollInterval);
        },
        onStop: () => clearInterval(blockInfoInterval),
      },
    );

    return {
      metadata: {
        height: undefined,
      },
      blockInfo: new ValueAndUpdates(blockInfoProducer),
      data: {
        message: "",
        txid: Encoding.toAscii(transactionId) as TxId,
        result: new Uint8Array([]),
      },
    };
  }

  public async getTicker(searchTicker: TokenTicker): Promise<BcpQueryEnvelope<BcpTicker>> {
    const results = (await this.getAllTickers()).data.filter(t => t.tokenTicker === searchTicker);
    return dummyEnvelope(results);
  }

  public async getAllTickers(): Promise<BcpQueryEnvelope<BcpTicker>> {
    const tickers: ReadonlyArray<BcpTicker> = [
      {
        tokenTicker: constants.primaryTokenTicker,
        tokenName: constants.primaryTokenName,
      },
    ];
    return dummyEnvelope(tickers);
  }

  public async getAccount(query: BcpAccountQuery): Promise<BcpQueryEnvelope<BcpAccount>> {
    let address: Address;
    if (isAddressQuery(query)) {
      address = query.address;
    } else if (isPubkeyQuery(query)) {
      address = liskCodec.keyToAddress(query.pubkey);
    } else {
      throw new Error("Query type not supported");
    }
    const url = this.baseUrl + `/api/accounts?address=${address}`;
    const result = await axios.get(url);
    const responseBody = result.data;

    // here we are expecting 0 or 1 results
    const accounts: ReadonlyArray<BcpAccount> = responseBody.data.map(
      (item: any): BcpAccount => ({
        address: address,
        name: undefined,
        balance: [
          {
            quantity: Parse.parseQuantity(item.balance),
            fractionalDigits: constants.primaryTokenFractionalDigits,
            tokenName: constants.primaryTokenName,
            tokenTicker: constants.primaryTokenTicker,
          },
        ],
      }),
    );
    return dummyEnvelope(accounts);
  }

  public getNonce(_: BcpAddressQuery | BcpPubkeyQuery): Promise<BcpQueryEnvelope<Nonce>> {
    return Promise.resolve(dummyEnvelope([generateNonce()]));
  }

  public changeBlock(): Stream<number> {
    throw new Error("Not implemented");
  }

  public watchAccount(_: BcpAccountQuery): Stream<BcpAccount | undefined> {
    throw new Error("Not implemented");
  }

  public watchNonce(_: BcpAddressQuery | BcpPubkeyQuery): Stream<Nonce | undefined> {
    throw new Error("Not implemented");
  }

  public async searchTx(query: BcpTxQuery): Promise<ReadonlyArray<ConfirmedTransaction>> {
    if (query.height || query.minHeight || query.maxHeight || query.tags.length) {
      throw new Error("Query by height, minHeight, maxHeight, tags not supported");
    }

    if (query.hash) {
      const transactionId = fromAscii(query.hash);

      const url = this.baseUrl + `/api/transactions?id=${transactionId}`;
      const result = await axios.get(url);
      const responseBody = result.data;
      if (responseBody.data.length === 0) {
        return [];
      }

      const transactionJson = responseBody.data[0];
      const height = new Int53(transactionJson.height);
      const confirmations = new Int53(transactionJson.confirmations);

      const transaction = liskCodec.parseBytes(
        toUtf8(JSON.stringify(transactionJson)) as PostableBytes,
        this.myChainId,
      );
      return [
        {
          ...transaction,
          height: height.toNumber(),
          confirmations: confirmations.toNumber(),
          txid: query.hash,
        },
      ];
    } else {
      throw new Error("Unsupported query.");
    }
  }

  public listenTx(_: ReadonlyArray<BcpQueryTag>): Stream<ConfirmedTransaction> {
    throw new Error("Not implemented");
  }

  public liveTx(_: BcpTxQuery): Stream<ConfirmedTransaction> {
    throw new Error("Not implemented");
  }
}
