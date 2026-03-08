"use client";

import { useReadContract } from "wagmi";
import { parseAbi } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { MarketCard } from "./MarketCard";

export function MarketFeed() {
    const abi = parseAbi(CONTRACT_ABI);

    const { data: nextMarketId } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "nextMarketId",
        query: { refetchInterval: 3000 }
    });

    const { data: startMarketId } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "startMarketId",
        query: { refetchInterval: 3000 }
    });

    const start = startMarketId ? Number(startMarketId) : 0;
    const end = nextMarketId ? Number(nextMarketId) : 0;
    const numVisible = end - start;

    return (
        <div className="my-8">
            <h2 className="text-3xl font-black tracking-tight mb-6 flex items-center">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">Live Markets</span>
                <div className="ml-4 h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
            </h2>

            {numVisible <= 0 ? (
                <div className="text-center p-12 bg-gray-900/50 border border-gray-800 rounded-2xl">
                    <p className="text-gray-400 text-lg">No markets active yet.</p>
                    <p className="text-gray-500 text-sm mt-2">Use the admin panel to create one for the demo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: numVisible }).map((_, i) => (
                        <MarketCard key={start + numVisible - 1 - i} marketId={start + numVisible - 1 - i} />
                    ))}
                </div>
            )}
        </div>
    );
}
