// Ambient type declaration for write-file-atomic v7 (ships no bundled types
// and @types/write-file-atomic targets an older major). Covers the Promise API
// used by config.ts and profile/linkedin.ts.
declare module 'write-file-atomic' {
  interface Options {
    chown?: { uid: number; gid: number } | false
    encoding?: BufferEncoding | null
    fsync?: boolean
    mode?: number
    tmpfileCreated?: (tmpfile: string) => void
  }

  function writeFileAtomic(
    filename: string,
    data: string | Buffer | NodeJS.TypedArray,
    options?: Options | BufferEncoding,
  ): Promise<void>

  export default writeFileAtomic
}
