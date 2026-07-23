import { VectorProvider } from "../MemoryProvider";

/**
 * StubVectorProvider — contrato apenas.
 * Embeddings / Vector DB NÃO implementados nesta fase.
 */
export class StubVectorProvider implements VectorProvider {
  readonly name = "StubVectorProvider";
  readonly implemented = false as const;

  async searchSimilar(): Promise<never> {
    throw new Error("ERR_VECTOR_NOT_IMPLEMENTED: embeddings deferred to future phase");
  }

  async index(): Promise<never> {
    throw new Error("ERR_VECTOR_NOT_IMPLEMENTED: embeddings deferred to future phase");
  }

  async delete(): Promise<never> {
    throw new Error("ERR_VECTOR_NOT_IMPLEMENTED: embeddings deferred to future phase");
  }
}

export default new StubVectorProvider();
