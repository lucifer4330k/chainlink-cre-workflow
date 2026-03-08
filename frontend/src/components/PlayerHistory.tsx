"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

function SingleBetRow({
    marketId,
    userAddress,
    betSide,
    mediaUrl,
    resolved,
    isReal,
    betAmount,
    claimed
}: {
    marketId: number;
    userAddress: `0x${string}`;
    betSide: boolean;
    mediaUrl: string;
    resolved: boolean;
    isReal: boolean;
    betAmount: bigint;
    claimed: boolean;
}) {
    const { data: hash, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

    const sideLabel = betSide ? "REAL" : "FAKE";

    let status: "pending" | "won" | "lost" = "pending";
    if (resolved) {
        // User wins if their bet side matches the AI verdict
        status = betSide === isReal ? "won" : "lost";
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
        <div className={`flex items-center justify-between rounded-xl p-4 transition-colors border ${status === "won" ? "bg-green-950/20 border-green-800/50 hover:border-green-700" :
            status === "lost" ? "bg-red-950/20 border-red-800/50 hover:border-red-700" :
                "bg-black/40 border-gray-800 hover:border-gray-700"
            }`}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-gray-400 text-sm">
                    #{marketId}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 truncate font-mono" title={mediaUrl}>
                        {mediaUrl.length > 40 ? mediaUrl.slice(0, 40) + "..." : mediaUrl}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${betSide ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                            BET {sideLabel}
                        </span>
                        <span className="text-sm text-white font-mono">
                            {formatEther(betAmount)} ETH
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider ${statusColors[status]}`}>
                    {statusIcons[status]} {status === "pending" ? "PENDING" : status === "won" ? "WON" : "LOST"}
                </span>

                {claimed && (
                    <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-800 rounded-lg">✓ CLAIMED</span>
                )}

                {canClaim && (
                    <button
                        onClick={handleClaim}
                        disabled={isPending || isConfirming}
                        className="text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-[0_0_10px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap animate-pulse"
                    >
                        {isPending || isConfirming ? "CLAIMING..." : "💰 CLAIM"}
                    </button>
                )}

                {resolved && status === "lost" && (
                    <span className="text-xs text-red-500/70 font-medium px-2 py-1">No payout</span>
                )}
            </div>
        </div>
    );
}

function BetRow({ marketId, userAddress }: { marketId: number; userAddress: `0x${string}` }) {
    const abi = parseAbi(CONTRACT_ABI);
    const pollInterval = 3000;

    const { data: marketData } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "markets", args: [BigInt(marketId)],
        query: { refetchInterval: pollInterval },
    });
    const { data: trueWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers", args: [BigInt(marketId), userAddress, true],
        query: { refetchInterval: pollInterval },
    });
    const { data: falseWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers", args: [BigInt(marketId), userAddress, false],
        query: { refetchInterval: pollInterval },
    });
    const { data: claimed } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "hasClaimed", args: [BigInt(marketId), userAddress],
        query: { refetchInterval: pollInterval },
    });

    if (!marketData) return null;
    const [mediaUrl, , , resolved, isReal] = marketData as [string, bigint, bigint, boolean, boolean];

    const trueBet = (trueWager as bigint) || BigInt(0);
    const falseBet = (falseWager as bigint) || BigInt(0);
    const hasTrueBet = trueBet > BigInt(0);
    const hasFalseBet = falseBet > BigInt(0);

    if (!hasTrueBet && !hasFalseBet) return null;

    // Show EACH bet side as a separate row
    return (
        <>
            {hasTrueBet && (
                <SingleBetRow
                    marketId={marketId}
                    userAddress={userAddress}
                    betSide={true}
                    mediaUrl={mediaUrl}
                    resolved={resolved}
                    isReal={isReal}
                    betAmount={trueBet}
                    claimed={claimed as boolean || false}
                />
            )}
            {hasFalseBet && (
                <SingleBetRow
                    marketId={marketId}
                    userAddress={userAddress}
                    betSide={false}
                    mediaUrl={mediaUrl}
                    resolved={resolved}
                    isReal={isReal}
                    betAmount={falseBet}
                    claimed={claimed as boolean || false}
                />
            )}
        </>
    );
}

export function PlayerHistory() {
    const { address, isConnected } = useAccount();
    const [isOpen, setIsOpen] = useState(true);
    const abi = parseAbi(CONTRACT_ABI);

    const { data: nextMarketId } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "nextMarketId",
        query: { refetchInterval: 3000 },
    });

    const { data: startMarketId } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "startMarketId",
        query: { refetchInterval: 3000 },
    });

    const start = startMarketId ? Number(startMarketId) : 0;
    const end = nextMarketId ? Number(nextMarketId) : 0;
    const numVisible = end - start;

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
                <div className="mt-3 bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-xs text-gray-500 font-mono">
                            Connected: {address.slice(0, 6)}...{address.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-500">
                            {numVisible} market{numVisible !== 1 ? 's' : ''} active
                        </p>
                    </div>

                    {numVisible <= 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No markets exist yet. Create one above!</p>
                        </div>
                    ) : (
                        Array.from({ length: numVisible }).map((_, i) => (
                            <BetRow key={start + i} marketId={start + i} userAddress={address} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

