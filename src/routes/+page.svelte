<script lang="ts">
    import { onMount } from "svelte";
    import { JOB_STATUS } from "$lib/types";
    import { createCrawlStore } from "$lib/stores/crawl.svelte";
    import StatusHeader from "./components/StatusHeader.svelte";
    import TerminalLog from "./components/TerminalLog.svelte";
    import CrawlForm from "./components/CrawlForm.svelte";
    import ResultActions from "./components/ResultActions.svelte";

    const store = createCrawlStore();

    let formComponent: CrawlForm;

    onMount(() => store.init());

    function handleSubmit() {
        store.submit().catch(() => {
            if (formComponent) formComponent.reset();
        });
    }

    function handleReset() {
        store.reset();
        if (formComponent) formComponent.reset();
    }

    const isActive = $derived(
        store.job.status !== JOB_STATUS.IDLE &&
            store.job.status !== JOB_STATUS.COMPLETED &&
            store.job.status !== JOB_STATUS.FAILED,
    );
</script>

<svelte:head>
    <title>WEB_FREEZER // ARCHIVE PROTOCOL</title>
</svelte:head>

<main class="cyber-container">
    <StatusHeader />

    <section class="terminal-box" aria-label="Crawl controls">
        {#if store.job.status === JOB_STATUS.IDLE}
            <CrawlForm
                bind:this={formComponent}
                bind:url={store.url}
                isSubmitting={false}
                canSubmit={store.canSubmit}
                onSubmit={handleSubmit}
                onToken={(token) => (store.turnstileToken = token)}
            />
        {:else if store.job.status === JOB_STATUS.SUBMITTING}
            <CrawlForm
                bind:this={formComponent}
                bind:url={store.url}
                isSubmitting={true}
                canSubmit={false}
                onSubmit={handleSubmit}
                onToken={(token) => (store.turnstileToken = token)}
            />
        {:else}
            <ResultActions
                downloadUrl={store.job.downloadUrl}
                hasError={store.job.status === JOB_STATUS.FAILED}
                {isActive}
                onReset={handleReset}
            />
        {/if}
    </section>

    <section aria-label="Activity log">
        <TerminalLog
            logs={store.logs}
            progress={store.job.progress}
            status={store.job.status}
        />
    </section>
</main>
