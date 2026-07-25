/// <reference types="vite/client" />

declare module 'occt-import-js' {
  interface OcctImportResultMesh {
    name?: string
    color?: [number, number, number]
    brep_faces?: Array<{ first: number; last: number; color: [number, number, number] | null }>
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index: { array: number[] }
  }

  interface OcctImportNode {
    name: string
    meshes: number[]
    children: OcctImportNode[]
  }

  interface OcctImportResult {
    success: boolean
    root: OcctImportNode
    meshes: OcctImportResultMesh[]
  }

  interface OcctInstance {
    ReadStepFile(content: Uint8Array, params: null | object): OcctImportResult
    ReadIgesFile(content: Uint8Array, params: null | object): OcctImportResult
    ReadBrepFile(content: Uint8Array, params: null | object): OcctImportResult
  }

  const factory: (options?: {
    locateFile?: (file: string) => string
  }) => Promise<OcctInstance>

  export default factory
  export type { OcctInstance, OcctImportResult, OcctImportResultMesh, OcctImportNode }
}
