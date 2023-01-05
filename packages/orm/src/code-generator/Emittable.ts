import { CodeFile } from "./CodeFile";

export interface Emittable {
  emit(file: CodeFile): void;
}
