export interface PromiseCallbacks {
    resolve: () => void;
    reject: (error: Error) => void;
}

export type ErrorListener = (error: Error) => void;
