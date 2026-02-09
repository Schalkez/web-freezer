<script lang="ts">
	import "../app.css";

	let { children } = $props();
</script>

<div class="app-shell">
	{@render children()}
</div>

<footer class="footer">
	<p>Web Freezer &mdash; Archive any website for offline use</p>
	<p>
		&copy; {new Date().getFullYear()}
		<a href="https://hiennguyen.io" target="_blank" rel="noopener"
			>hiennguyen.io</a
		>
	</p>
</footer>

<style>
	.app-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.footer {
		padding: var(--space-lg) var(--space-md);
		text-align: center;
		color: var(--text-muted);
		font-size: 0.8rem;
		border-top: 1px solid var(--border);
		margin-top: auto;
	}

	.footer a {
		color: var(--color-accent);
		text-decoration: none;
		transition: text-shadow 0.2s;
	}

	.footer a:hover {
		text-shadow: 0 0 8px var(--color-accent);
	}
</style>
