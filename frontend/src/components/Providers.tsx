"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia, baseSepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { type Chain } from "viem";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

const customAnvil = {
    id: 31337,
    name: "My Custom Anvil Network",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["http://127.0.0.1:8545"] },
    },
} as const satisfies Chain;

const queryClient = new QueryClient();

function ProvidersInner({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    const config = useMemo(() => {
        return getDefaultConfig({
            appName: "DeepFakeMarket",
            projectId: "a3e89587a8b6f3c02eb92eeccc32efdb",
            chains: [customAnvil, arbitrumSepolia, baseSepolia],
            ssr: false,
        });
    }, []);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div style={{ minHeight: "100vh" }} />;
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme()}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export const Providers = dynamic(() => Promise.resolve(ProvidersInner), {
    ssr: false,
});
