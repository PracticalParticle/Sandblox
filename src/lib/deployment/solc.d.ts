declare module 'solc' {
  interface SolcWrapper {
    compile: (input: string) => string
    version: () => string
  }

  const solc: SolcWrapper
  export default solc
} 