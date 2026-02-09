<script lang="ts">
    let { online = true, visitorId = "GUEST" } = $props();
</script>

<div class="cyber-header">
    <h1 class="glitch" data-text="WEB_FREEZER">WEB_FREEZER</h1>
    <div class="status-line">
        <span
            >STATUS: <span class={online ? "online" : "offline"}
                >{online ? "ONLINE" : "OFFLINE"}</span
            ></span
        >
        <span>SYS_OP: {visitorId}</span>
        <span>VER: 2.0.0</span>
    </div>
</div>

<style>
    .cyber-header {
        text-align: center;
        margin-bottom: 2rem;
        position: relative;
    }

    .glitch {
        position: relative;
        font-size: clamp(2rem, 6vw, 4rem);
        letter-spacing: 0.1em;
        display: inline-block;
        color: var(--color-accent);
        animation: glow-pulse 3s ease-in-out infinite;
    }

    .glitch::before,
    .glitch::after {
        content: attr(data-text);
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.8;
    }

    .glitch::before {
        color: #ff3333;
        clip-path: inset(0 0 60% 0);
        animation: glitch-shift 4s infinite linear alternate-reverse;
    }

    .glitch::after {
        color: #00ff66;
        clip-path: inset(60% 0 0 0);
        animation: glitch-shift 3s infinite linear alternate;
    }

    @keyframes glitch-shift {
        0%,
        95% {
            transform: translateX(0);
        }
        96% {
            transform: translateX(-3px);
        }
        97% {
            transform: translateX(3px);
        }
        98% {
            transform: translateX(-1px);
        }
        99% {
            transform: translateX(2px);
        }
        100% {
            transform: translateX(0);
        }
    }

    .online {
        color: #00ff66;
        text-shadow: 0 0 10px #00ff66;
    }

    .offline {
        color: #ff3333;
        text-shadow: 0 0 10px #ff3333;
    }

    .status-line {
        display: flex;
        justify-content: center;
        gap: 2rem;
        font-size: 0.875rem;
        color: var(--color-dim);
        margin-top: 0.5rem;
        font-family: var(--font-mono);
    }
</style>
