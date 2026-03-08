"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, formatEther, parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

export function MarketCard({ marketId }: { marketId: number }) {
    const [amount, setAmount] = useState("0.01");
    const [isFullscreen, setIsFullscreen] = useState(false);

    const { data: marketData, refetch } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        functionName: "markets",
        args: [BigInt(marketId)],
        query: { refetchInterval: 3000 },
    });

    const { data: hash, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    if (!marketData) return <div className="animate-pulse bg-gray-800 h-64 rounded-xl"></div>;

    const [mediaUrl, totalTrue, totalFalse, resolved, isReal] = marketData as [string, bigint, bigint, boolean, boolean];

    const handleBet = (guess: boolean) => {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "placeWager",
            args: [BigInt(marketId), guess],
            value: parseEther(amount),
        }, {
            onSuccess: () => {
                setTimeout(() => refetch(), 3000); // refresh after tx
            }
        });
    };
    const handleClaim = () => {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "claimWinnings",
            args: [BigInt(marketId)],
        }, {
            onSuccess: () => {
                setTimeout(() => refetch(), 3000);
            }
        });
    };

    const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov');

    return (
        <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors shadow-2xl flex flex-col h-full">
                <div
                    className="relative h-56 bg-gradient-to-br from-black to-gray-900 flex items-center justify-center overflow-hidden group cursor-pointer"
                    onClick={() => setIsFullscreen(true)}
                >
                    {isVideo ? (
                        <video src={mediaUrl} controls autoPlay muted loop className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                    ) : (
                        <img src={mediaUrl} alt="Market Media" className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-none">
                        <span className="bg-black/50 text-white px-3 py-1 rounded-full backdrop-blur-sm text-sm font-medium shadow-xl">⛶ Expand</span>
                    </div>

                    {resolved && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-md z-20 transition-all pointer-events-none">
                            <span className="text-3xl font-black tracking-widest text-white uppercase drop-shadow-lg mb-3">RESOLVED</span>
                            <span className={`text-xl font-black px-6 py-2 rounded-xl shadow-2xl ${isReal ? 'bg-gradient-to-r from-green-600 to-green-400 text-white' : 'bg-gradient-to-r from-red-600 to-red-400 text-white'}`}>
                                {isReal ? "✓ REAL" : "❌ DEEPFAKE"}
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 truncate block mb-4 bg-blue-900/20 py-2 px-3 rounded-lg border border-blue-900/50 transition-colors"
                        title={mediaUrl}
                    >
                        🔗 {mediaUrl}
                    </a>

                    <div className="flex justify-between text-sm text-gray-400 mb-4 font-mono">
                        <div className="flex flex-col">
                            <span className="text-green-400">REAL POOL</span>
                            <span className="text-white text-lg font-semibold">{formatEther(totalTrue)} ETH</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-red-400">FAKE POOL</span>
                            <span className="text-white text-lg font-semibold">{formatEther(totalFalse)} ETH</span>
                        </div>
                    </div>

                    {!resolved ? (
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2 bg-black border border-gray-800 p-1 rounded-lg">
                                <span className="text-gray-500 pl-3 font-mono text-sm">ETH</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-transparent text-white focus:outline-none py-2 font-mono"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleBet(true)}
                                    disabled={isPending || isConfirming}
                                    className="bg-green-600/10 hover:bg-green-600/20 border border-green-600/50 text-green-400 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                                >
                                    BET REAL
                                </button>
                                <button
                                    onClick={() => handleBet(false)}
                                    disabled={isPending || isConfirming}
                                    className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/50 text-red-400 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                                >
                                    BET FAKE
                                </button>
                            </div>
                            {(isPending || isConfirming) && <p className="text-center w-full text-xs text-blue-400 mt-2 animate-pulse">Confirming transaction...</p>}
                        </div>
                    ) : (
                        <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col gap-2">
                            <button
                                onClick={handleClaim}
                                disabled={isPending || isConfirming}
                                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold text-white transition-all shadow-[0_0_15px_rgba(37,99,235,0.5)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending || isConfirming ? "CLAIMING..." : "CLAIM WINNINGS"}
                            </button>
                            {(isPending || isConfirming) && <p className="text-center w-full text-xs text-blue-400 animate-pulse">Confirming claim...</p>}
                        </div>
                    )}
                </div>
            </div>

            {isFullscreen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
                    onClick={() => setIsFullscreen(false)}
                >
                    <div className="relative max-w-7xl max-h-screen">
                        <button
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 font-bold text-xl bg-gray-800/50 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                            onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
                        >
                            ✕
                        </button>
                        {isVideo ? (
                            <video src={mediaUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                        ) : (
                            <img src={mediaUrl} alt="Fullscreen Media" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
