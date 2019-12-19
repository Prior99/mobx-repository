import { ErrorListener } from "./listener";

export interface Repository {
    addErrorListener(listener: ErrorListener): void;
    removeErrorListener(listener: ErrorListener): void;
    reset(): void;
}
