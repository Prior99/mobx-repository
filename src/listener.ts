export interface Listener {
    resolve: () => void;
    reject: (error: Error) => void;
}

export type ErrorListener = (error: Error) => void;
