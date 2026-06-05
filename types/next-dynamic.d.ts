// Shim for next/dynamic — the .d.ts is absent in this Next.js install
declare module "next/dynamic" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function dynamic(loader: () => Promise<any>, options?: { ssr?: boolean; loading?: React.ComponentType }): React.ComponentType<any>;
  export default dynamic;
}
