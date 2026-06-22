declare module "heic-decode" {
  export interface HeicDecodeOptions {
    buffer: Uint8Array | ArrayBuffer | Buffer;
  }
  export interface HeicDecodeResult {
    width: number;
    height: number;
    /** RGBA pixel data, length === width * height * 4 */
    data: Uint8Array;
  }
  const heicDecode: (options: HeicDecodeOptions) => Promise<HeicDecodeResult>;
  export default heicDecode;
}
