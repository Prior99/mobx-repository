import { ErrorListener } from "./listeners";

/**
 * Basic features every repository needs to provide.
 */
export interface Repository {
    /**
     * Attach a listener to the repository that is invoked whenever the repository encounters an error.
     * 
     * @param listener A listener to invoke whenever the repository encounters an error.
     */
    addErrorListener(listener: ErrorListener): void;

    /**
     * Remove a previously attached error listener from this repository.
     * 
     * @param listener The error listener to remove again.
     */
    removeErrorListener(listener: ErrorListener): void;

    /**
     * Reset the repository to its initial state.
     * This should not reset the error listeners, but only the repository's state.
     */
    reset(): void;
}
