<script lang="ts">
    let {
        downloadUrl = null,
        hasError = false,
        isActive = false,
        onReset,
    } = $props<{
        downloadUrl: string | null;
        hasError: boolean;
        isActive: boolean;
        onReset: () => void;
    }>();
</script>

{#if downloadUrl}
    <div class="result-actions fade-in" role="status" aria-live="polite">
        <div class="status-text">// ARCHIVE_READY</div>
        <div class="actions-row">
            <a
                href={downloadUrl}
                class="cyber-btn download-action"
                download
                aria-label="Download archived website as ZIP"
            >
                [ DOWNLOAD_ARCHIVE.ZIP ]
            </a>
            <button
                class="btn-outline"
                onclick={onReset}
                aria-label="Start a new archiving session"
            >
                [ NEW_SESSION ]
            </button>
        </div>
    </div>
{:else if hasError}
    <div class="result-actions fade-in" role="alert">
        <div class="status-text error-text">// CRAWL_FAILED</div>
        <div class="actions-row">
            <button
                class="cyber-btn"
                onclick={onReset}
                aria-label="Retry the crawl"
            >
                [ RETRY ]
            </button>
        </div>
    </div>
{:else if isActive}
    <div class="result-actions fade-in" role="status" aria-live="polite">
        <div class="status-text">// CRAWLING_IN_PROGRESS...</div>
        <div class="actions-row">
            <button
                class="btn-outline"
                onclick={onReset}
                aria-label="Abort current crawl"
            >
                [ ABORT ]
            </button>
        </div>
    </div>
{/if}

<style>
    .result-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem 0;
    }

    .status-text {
        font-family: var(--font-mono);
        font-size: 0.85rem;
        color: var(--color-accent);
        text-shadow: 0 0 6px var(--color-accent);
    }

    .error-text {
        color: var(--color-error);
        text-shadow: 0 0 6px var(--color-error);
    }

    .actions-row {
        display: flex;
        justify-content: center;
        gap: 1rem;
    }

    .btn-outline {
        background: transparent;
        border: 1px solid var(--color-dim);
        color: var(--color-dim);
        padding: 0.6rem 1.5rem;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        cursor: pointer;
        text-transform: uppercase;
        transition: all 0.2s;
    }

    .btn-outline:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
    }
</style>
