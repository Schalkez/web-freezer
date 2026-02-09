<script lang="ts">
    import type { LogEntry, JobStatus } from "$lib/types";
    import { JOB_STATUS } from "$lib/types";

    let {
        logs = [],
        progress = 0,
        status = JOB_STATUS.IDLE,
    } = $props<{
        logs: LogEntry[];
        progress: number;
        status: JobStatus;
    }>();

    let logContainer: HTMLDivElement;

    const isActive = $derived(
        status === JOB_STATUS.SUBMITTING ||
            status === JOB_STATUS.PENDING ||
            status === JOB_STATUS.CRAWLING,
    );

    // Terminal-style progress bar: [▓▓▓▓▓▓▓▓░░░░░░░░░░░░] 42%
    const progressBar = $derived.by(() => {
        const width = 20;
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        return `[${"▓".repeat(filled)}${"░".repeat(empty)}] ${progress}%`;
    });

    $effect(() => {
        logs.length;
        if (logContainer) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    });
</script>

<div
    class="terminal-box terminal-log"
    role="log"
    aria-live="polite"
    aria-label="Crawl activity log"
    bind:this={logContainer}
>
    {#each logs as log}
        <div class="line">
            <span class="timestamp">[{log.time}]</span>
            <span class={log.type}>
                {log.type === "info" ? ">" : log.type === "error" ? "!" : "#"}
                {log.message}
            </span>
        </div>
    {/each}

    {#if isActive}
        <div class="line progress-line">
            <span class="timestamp">&nbsp;</span>
            {#if progress > 0}
                <span class="progress-text">{progressBar}</span>
            {:else}
                <span class="progress-text scanning"
                    >[ ░░▓▓░░░░░░░░░░░░░░░░ ] scanning...</span
                >
            {/if}
        </div>
    {/if}
</div>

<style>
    .terminal-log {
        font-size: 0.8rem;
        line-height: 1.6;
        color: var(--color-dim);
        height: 200px;
        max-height: 200px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #333 transparent;
        display: flex;
        flex-direction: column;
    }

    .terminal-log .line {
        margin-bottom: 0.25rem;
        display: flex;
        gap: 1ch;
    }

    .terminal-log .timestamp {
        color: #444;
    }

    .progress-line {
        margin-top: 0.25rem;
    }

    .progress-text {
        color: var(--color-accent);
        font-family: var(--font-mono);
        text-shadow: 0 0 6px var(--color-accent);
    }

    .scanning {
        animation: blink 1s step-end infinite;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }

    .info {
        color: var(--color-accent);
    }
    .warn {
        color: #ffcc00;
    }
    .error {
        color: var(--color-error);
    }
    .success {
        color: #00ff66;
    }
</style>
