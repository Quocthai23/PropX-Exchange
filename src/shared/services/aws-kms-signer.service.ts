import {
  KMSClient,
  SignCommand,
  SigningAlgorithmSpec,
} from '@aws-sdk/client-kms';
import {
  AbstractSigner,
  Provider,
  Signature,
  Transaction,
  TransactionRequest,
  TypedDataDomain,
  TypedDataField,
  keccak256,
  recoverAddress,
  getAddress,
  resolveAddress,
  toUtf8Bytes,
} from 'ethers';

const SECP256K1_N = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
);
const SECP256K1_HALF_N = SECP256K1_N / 2n;

function trimHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function ensure32BytesHex(value: bigint): string {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

function parseKmsDerSignature(derHexWithPrefix: string): {
  r: bigint;
  s: bigint;
} {
  const derHex = trimHexPrefix(derHexWithPrefix);
  if (!derHex.startsWith('30')) {
    throw new Error('Invalid DER signature format from AWS KMS.');
  }

  let cursor = 2;
  const sequenceLength = parseInt(derHex.slice(cursor, cursor + 2), 16);
  cursor += 2;
  if (sequenceLength * 2 !== derHex.length - 4) {
    throw new Error('Unexpected DER sequence length from AWS KMS.');
  }

  if (derHex.slice(cursor, cursor + 2) !== '02') {
    throw new Error('Invalid DER signature R marker.');
  }
  cursor += 2;
  const rLength = parseInt(derHex.slice(cursor, cursor + 2), 16);
  cursor += 2;
  const rHex = derHex.slice(cursor, cursor + rLength * 2);
  cursor += rLength * 2;

  if (derHex.slice(cursor, cursor + 2) !== '02') {
    throw new Error('Invalid DER signature S marker.');
  }
  cursor += 2;
  const sLength = parseInt(derHex.slice(cursor, cursor + 2), 16);
  cursor += 2;
  const sHex = derHex.slice(cursor, cursor + sLength * 2);

  return { r: BigInt(`0x${rHex}`), s: BigInt(`0x${sHex}`) };
}

export class AwsKmsSigner extends AbstractSigner {
  private readonly kmsClient: KMSClient;
  private readonly keyId: string;
  private readonly signerAddress: string;

  constructor(
    kmsClient: KMSClient,
    keyId: string,
    signerAddress: string,
    provider?: Provider | null,
  ) {
    super(provider ?? undefined);
    this.kmsClient = kmsClient;
    this.keyId = keyId;
    this.signerAddress = getAddress(signerAddress);
  }

  connect(provider: null | Provider): AwsKmsSigner {
    return new AwsKmsSigner(
      this.kmsClient,
      this.keyId,
      this.signerAddress,
      provider,
    );
  }

  async getAddress(): Promise<string> {
    return this.signerAddress;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const digest = keccak256(
      typeof message === 'string' ? toUtf8Bytes(message) : message,
    );
    return this.signDigest(digest);
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    const resolvedTo = tx.to
      ? await resolveAddress(tx.to, this.provider)
      : undefined;
    const txWithoutFrom: Record<string, unknown> = { ...tx };
    delete txWithoutFrom.from;
    const resolvedTx = await Transaction.from({
      ...(txWithoutFrom as any),
      to: resolvedTo,
      from: undefined,
    });
    const unsignedSerialized = resolvedTx.unsignedSerialized;
    const digest = keccak256(unsignedSerialized);
    const signatureHex = await this.signDigest(digest);

    return Transaction.from({
      ...resolvedTx,
      signature: Signature.from(signatureHex),
    }).serialized;
  }

  async signTypedData(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _domain: TypedDataDomain,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _types: Record<string, TypedDataField[]>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _value: Record<string, unknown>,
  ): Promise<string> {
    throw new Error(
      'AwsKmsSigner.signTypedData is not implemented for this module.',
    );
  }

  private async signDigest(digestHex: string): Promise<string> {
    const digest = Buffer.from(trimHexPrefix(digestHex), 'hex');
    const result = await this.kmsClient.send(
      new SignCommand({
        KeyId: this.keyId,
        Message: digest,
        MessageType: 'DIGEST',
        SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256,
      }),
    );

    if (!result.Signature) {
      throw new Error('AWS KMS returned empty signature.');
    }

    const sig = parseKmsDerSignature(
      `0x${Buffer.from(result.Signature).toString('hex')}`,
    );
    const r = sig.r;
    let s = sig.s;
    if (s > SECP256K1_HALF_N) {
      s = SECP256K1_N - s;
    }

    const rHex = ensure32BytesHex(r);
    const sHex = ensure32BytesHex(s);
    let recovered = recoverAddress(digestHex, { r: rHex, s: sHex, yParity: 0 });
    const yParity =
      recovered.toLowerCase() === this.signerAddress.toLowerCase() ? 0 : 1;
    recovered = recoverAddress(digestHex, { r: rHex, s: sHex, yParity });
    if (recovered.toLowerCase() !== this.signerAddress.toLowerCase()) {
      throw new Error('Unable to recover signer address from KMS signature.');
    }

    return Signature.from({ r: rHex, s: sHex, yParity }).serialized;
  }
}
