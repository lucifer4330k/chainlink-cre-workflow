"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

function BetRow({ marketId, userAddress }: { marketId: number; userAddress: `0x${string}` }) {
    const abi = parseAbi(CONTRACT_ABI);

    const { data: marketData } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "markets", args: [BigInt(marketId)],
    });
    const { data: trueWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers", args: [BigInt(marketId), userAddress, true],
    });
    const { data: falseWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers", args: [BigInt(marketId), userAddress, false],
    });
    const { data: claimed } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "hasClaimed", args: [BigInt(marketId), userAddress],
    });

    const { data: hash, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

    if (!marketData) return null;
    const [mediaUrl, , , resolved, isReal] = marketData as [string, bigint, bigint, boolean, boolean];

    const trueBet = trueWager as bigint | undefined;
    const falseBet = falseWager as bigint | undefined;
    const hasTrueBet = trueBet && trueBet > 0n;
    const hasFalseBet = falseBet && falseBet > 0n;

    // Skip markets where the user has no bets
    if (!hasTrueBet && !hasFalseBet) return null;

    const userBetReal = hasTrueBet;
    const userBetAmount = userBetReal ? trueBet! : falseBet!;
    const userBetSide = userBetReal ? "REAL" : "FAKE";

    let status: "pending" | "won" | "lost" = "pending";
    if (resolved) {
        status = (userBetReal && isReal) || (!userBetReal && !isReal) ? "won" : "lost";
    }

    const canClaim = resolved && status === "won" && !claimed;

    const handleClaim = () => {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "claimWinnings",
            args: [BigInt(marketId)],
        });
    };

    const statusColors = {
        pending: "text-yellow-400 bg-yellow-900/30 border-yellow-700/50",
        won: "text-green-400 bg-green-900/30 border-green-700/50",
        lost: "text-red-400 bg-red-900/30 border-red-700/50",
    };

    const statusIcons = { pending: "⏳", won: "🏆", lost: "💀" };

    return (
        <div className="flex items-center justify-between bg-black/40 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-sm">
                    #{marketId}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 truncate font-mono" title={mediaUrl}>
                        {mediaUrl.length > 40 ? mediaUrl.slice(0, 40) + "..." : mediaUrl}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${userBetReal ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                            BET {userBetSide}
                        </span>
                        <span className="text-sm text-white font-mono">
                            {formatEther(userBetAmount)} ETH
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider ${statusColors[status]}`}>
                    {statusIcons[status]} {status === "pending" ? "PENDING" : status === "won" ? "WON" : "LOST"}
                </span>

                {claimed && (
                    <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-800 rounded-lg">CLAIMED</span>
                )}

                {canClaim && (
                    <button
                        onClick={handleClaim}
                        disabled={isPending || isConfirming}
                        className="text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-[0_0_10px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isPending || isConfirming ? "CLAIMING..." : "💰 CLAIM"}
                    </button>
                )}
            </div>
        </div>
    );
}

export function PlayerHistory() {
    const { address, isConnected } = useAccount();
    const [isOpen, setIsOpen] = useState(false);

    const { data: nextMarketId } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        functionName: "nextMarketId",
        query: { refetchInterval: 5000 },
    });

    const numMarkets = nextMarketId ? Number(nextMarketId) : 0;

    if (!isConnected || !address) {
        return null;
    }

    return (
        <div className="my-8">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-gradient-to-r from-gray-900 to-black border border-gray-800 rounded-xl px-6 py-4 hover:border-gray-700 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <span className="bg-purple-600 text-white w-8 h-8 flex items-center justify-center rounded-lg text-sm shadow-[0_0_12px_rgba(147,51,234,0.4)]">📊</span>
                    <span className="text-lg font-black text-white tracking-wide">MY BETS & WINNINGS</span>
                </div>
                <span className={`text-gray-400 text-xl transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                </span>
            </button>

            {isOpen && (
                <div className="mt-3 bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-xs text-gray-500 font-mono">
                            Connected: {address.slice(0, 6)}...{address.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">
                            {numMarkets} market{numMarkets !== 1 ? 's' : ''} total
                        </p>
                    </div>

                    {numMarkets === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No markets exist yet.</p>
                        </div>
                    ) : (
                        Array.from({ length: numMarkets }).map((_, i) => (
                            <BetRow key={i} marketId={i} userAddress={address} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
