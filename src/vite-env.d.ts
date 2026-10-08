/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path of Lumo's AI endpoints, or "off" for static hosting. Default "/api/lumo". */
  readonly VITE_LUMO_API?: string;
}
