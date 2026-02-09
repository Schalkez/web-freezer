<script lang="ts">
    import { onMount } from "svelte";

    let {
        url = $bindable(""),
        isSubmitting = false,
        canSubmit = false,
        onSubmit,
        onToken,
    } = $props<{
        url: string;
        isSubmitting: boolean;
        canSubmit: boolean;
        onSubmit: () => void;
        onToken: (token: string) => void;
    }>();

    let turnstileContainer: HTMLDivElement;
    let turnstileWidgetId: string | null = null;

    onMount(() => {
        const check = setInterval(() => {
            if ((window as any).turnstile) {
                clearInterval(check);
                renderTurnstile();
            }
        }, 200);

        return () => {
            clearInterval(check);
        };
    });

    function renderTurnstile() {
        if (!turnstileContainer) return;
        turnstileWidgetId = (window as any).turnstile.render(
            turnstileContainer,
            {
                sitekey: "0x4AAAAAACZh6penZBTNI3h1",
                theme: "dark",
                callback: (token: string) => {
                    onToken(token);
                },
                "expired-callback": () => {
                    onToken("");
                },
            },
        );
    }

    export function reset() {
        if (turnstileWidgetId !== null && (window as any).turnstile) {
            (window as any).turnstile.reset(turnstileWidgetId);
        }
        onToken("");
    }
</script>

<div class="input-group fade-in">
    <div class="prefix" aria-hidden="true">&gt;</div>
    <input
        id="target-url"
        type="url"
        class="cyber-input"
        placeholder="ENTER_TARGET_URL..."
        aria-label="Website URL to archive"
        bind:value={url}
        disabled={isSubmitting}
        onkeydown={(e) => e.key === "Enter" && canSubmit && onSubmit()}
    />
</div>

<div class="control-row fade-in">
    <div class="captcha-wrapper" bind:this={turnstileContainer}></div>
    <button
        id="execute-btn"
        class="cyber-btn"
        disabled={!canSubmit || isSubmitting}
        onclick={onSubmit}
        aria-label={isSubmitting
            ? "Processing crawl request"
            : "Start website archiving"}
    >
        {#if isSubmitting}
            [ PROCESSING ]
        {:else}
            [ EXECUTE ]
        {/if}
    </button>
</div>

<style>
    .input-group {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .prefix {
        color: var(--color-accent);
        font-weight: bold;
        font-size: 1.5rem;
        text-shadow: 0 0 8px var(--color-accent);
        animation: cursor-pulse 1.2s ease-in-out infinite;
    }

    .control-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .prefix {
        font-size: 1.1rem;
    }

    .captcha-wrapper {
        transform: scale(0.8);
        transform-origin: center;
    }
</style>
