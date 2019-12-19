/**
 * A set of `resolve` and `reject` callbacks.
 */
export interface PromiseCallbacks {
    /**
     * A Promise's resolve callback.
     */
    resolve: () => void;

    /**
     * A Promise's reject callback.
     */
    reject: (error: Error) => void;
}

/**
 * A listener that can be invoked with an error.
 */
export type ErrorListener = (error: Error) => void;
