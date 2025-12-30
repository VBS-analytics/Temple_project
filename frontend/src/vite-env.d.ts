/// <reference types="vite/client" />

declare const __API_BASE_URL__: string;

declare module '*.js?url' {
  const url: string;
  export default url;
}
