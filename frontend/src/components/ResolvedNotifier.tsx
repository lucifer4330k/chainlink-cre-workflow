"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useWatchContractEvent, useReadContract } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

interface Toast {
    id: number;
    marketId: number;
    isReal: boolean;
    userWon: boolean;
    userBet: string;
    amount: string;
}

let toastCounter = 0;

export function ResolvedNotifier() {
    const { address, isConnected } = useAccount();
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Auto-dismiss after 8 seconds
    useEffect(() => {
        if (toasts.length === 0) return;
        const timer = setTimeout(() => {
            setToasts(prev => prev.slice(1));
        }, 8000);
        return () => clearTimeout(timer);
    }, [toasts]);

    // Watch for MarketResolved events
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        eventName: "MarketResolved",
        onLogs(logs: any[]) {
            if (!isConnected || !address) return;

            for (const log of logs) {
                const marketId = Number(log.args.marketId);
                const isReal = log.args.isReal as boolean;

                // We can't easily check the user's wager from within the event handler
                // So we create a toast that checks it via a child component
                const newToast: Toast = {
                    id: ++toastCounter,
                    marketId,
                    isReal,
                    userWon: false, // Will be determined by ToastCard
                    userBet: "",
                    amount: "",
                };
                setToasts(prev => [...prev, newToast]);
            }
        },
    });

    if (!isConnected || toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
            {toasts.map(toast => (
                <ToastCard
                    key={toast.id}
                    toast={toast}
                    userAddress={address!}
                    onDismiss={() => dismissToast(toast.id)}
                />
            ))}
        </div>
    );
}

function ToastCard({ toast, userAddress, onDismiss }: { toast: Toast; userAddress: `0x${string}`; onDismiss: () => void }) {
    const abi = parseAbi(CONTRACT_ABI);

    const { data: trueWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers",
        args: [BigInt(toast.marketId), userAddress, true],
    });
    const { data: falseWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers",
        args: [BigInt(toast.marketId), userAddress, false],
    });

    const trueBet = (trueWager as bigint) || BigInt(0);
    const falseBet = (falseWager as bigint) || BigInt(0);
    const hasBet = trueBet > BigInt(0) || falseBet > BigInt(0);

    if (!hasBet) return null; // User has no bets on this market

    const userBetReal = trueBet > BigInt(0);
    const userWon = (userBetReal && toast.isReal) || (!userBetReal && !toast.isReal);
    const betAmount = userBetReal ? trueBet : falseBet;

    return (
        <div
            className={`rounded-xl p-4 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500 cursor-pointer ${userWon
                    ? "bg-green-950/90 border-green-500/50 shadow-green-900/30"
                    : "bg-red-950/90 border-red-500/50 shadow-red-900/30"
                }`}
            onClick={onDismiss}
        >
            <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">{userWon ? "🏆" : "💀"}</span>
                <div className="flex-1 min-w-0">
                    <p className={`font-black text-sm tracking-wide ${userWon ? "text-green-400" : "text-red-400"}`}>
                        {userWon ? "YOU WON!" : "YOU LOST"}
                    </p>
                    <p className="text-white text-xs mt-1">
                        Market #{toast.marketId} resolved as <span className="font-bold">{toast.isReal ? "REAL" : "DEEPFAKE"}</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                        Your bet: {formatEther(betAmount)} ETH on {userBetReal ? "REAL" : "FAKE"}
                    </p>
                    {userWon && (
                        <p className="text-green-300 text-xs mt-1 font-bold animate-pulse">
                            💰 Open "MY BETS" to claim your winnings!
                        </p>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    className="text-gray-500 hover:text-white text-xs flex-shrink-0"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
