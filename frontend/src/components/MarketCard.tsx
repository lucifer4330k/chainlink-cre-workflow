"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseAbi, formatEther, parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";
import { useState } from "react";

export function MarketCard({ marketId }: { marketId: number }) {
    const [amount, setAmount] = useState("0.01");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { address, isConnected } = useAccount();
    const abi = parseAbi(CONTRACT_ABI);

    const { data: marketData, refetch } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "markets",
        args: [BigInt(marketId)],
        query: { refetchInterval: 3000 },
    });

    // Check user's existing bets
    const { data: trueWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers",
        args: [BigInt(marketId), address || "0x0000000000000000000000000000000000000000", true],
        query: { refetchInterval: 3000, enabled: !!address },
    });
    const { data: falseWager } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "wagers",
        args: [BigInt(marketId), address || "0x0000000000000000000000000000000000000000", false],
        query: { refetchInterval: 3000, enabled: !!address },
    });
    const { data: claimed } = useReadContract({
        address: CONTRACT_ADDRESS, abi, functionName: "hasClaimed",
        args: [BigInt(marketId), address || "0x0000000000000000000000000000000000000000"],
        query: { refetchInterval: 3000, enabled: !!address },
    });

    const { data: hash, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

    if (!marketData) return <div className="animate-pulse bg-gray-800 h-64 rounded-xl"></div>;

    const [mediaUrl, totalTrue, totalFalse, resolved, isReal] = marketData as [string, bigint, bigint, boolean, boolean];

    // User bet state
    const userTrueBet = (trueWager as bigint) || BigInt(0);
    const userFalseBet = (falseWager as bigint) || BigInt(0);
    const hasPlacedBet = userTrueBet > BigInt(0) || userFalseBet > BigInt(0);
    const userBetSide = userTrueBet > BigInt(0) ? true : false;
    const userBetAmount = userTrueBet > BigInt(0) ? userTrueBet : userFalseBet;
    const userWon = resolved && hasPlacedBet && (userBetSide === isReal);
    const userLost = resolved && hasPlacedBet && (userBetSide !== isReal);
    const hasClaimed = claimed as boolean || false;

    const handleBet = (guess: boolean) => {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "placeWager",
            args: [BigInt(marketId), guess],
            value: parseEther(amount),
        }, {
            onSuccess: () => { setTimeout(() => refetch(), 2000); }
        });
    };

    const handleClaim = () => {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(CONTRACT_ABI),
            functionName: "claimWinnings",
            args: [BigInt(marketId)],
        }, {
            onSuccess: () => { setTimeout(() => refetch(), 2000); }
        });
    };

    const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov');

    return (
        <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors shadow-2xl flex flex-col h-full">
                {/* Media Preview */}
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
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-md z-20 pointer-events-none">
                            <span className="text-3xl font-black tracking-widest text-white uppercase drop-shadow-lg mb-3">RESOLVED</span>
                            <span className={`text-xl font-black px-6 py-2 rounded-xl shadow-2xl ${isReal ? 'bg-gradient-to-r from-green-600 to-green-400 text-white' : 'bg-gradient-to-r from-red-600 to-red-400 text-white'}`}>
                                {isReal ? "✓ REAL" : "❌ DEEPFAKE"}
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    {/* Media Link */}
                    <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 truncate block mb-4 bg-blue-900/20 py-2 px-3 rounded-lg border border-blue-900/50"
                        title={mediaUrl}
                    >
                        🔗 {mediaUrl}
                    </a>

                    {/* Pool Stats */}
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

                    {/* === BETTING / RESULT AREA === */}
                    {!resolved ? (
                        // MARKET IS OPEN
                        hasPlacedBet ? (
                            // User already placed a bet — show their bet and "waiting" state
                            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
                                <p className="text-sm text-gray-400 mb-2">Your bet is placed!</p>
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <span className={`text-sm font-bold px-3 py-1 rounded-lg ${userBetSide ? 'bg-green-900/40 text-green-400 border border-green-700/50' : 'bg-red-900/40 text-red-400 border border-red-700/50'}`}>
                                        {userBetSide ? "BET REAL" : "BET FAKE"}
                                    </span>
                                    <span className="text-white font-mono text-sm">{formatEther(userBetAmount)} ETH</span>
                                </div>
                                <p className="text-xs text-yellow-400 animate-pulse mt-2">⏳ Waiting for AI verdict...</p>
                            </div>
                        ) : (
                            // User hasn't bet yet — show betting UI
                            <div className="space-y-3">
                                {!isConnected ? (
                                    <p className="text-center text-gray-500 text-sm py-4">Connect wallet to place a bet</p>
                                ) : (
                                    <>
                                        <div className="flex items-center space-x-2 bg-black border border-gray-800 p-1 rounded-lg">
                                            <span className="text-gray-500 pl-3 font-mono text-sm">ETH</span>
                                            <input
                                                type="number" step="0.01" value={amount}
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
                                                BET REAL ✓
                                            </button>
                                            <button
                                                onClick={() => handleBet(false)}
                                                disabled={isPending || isConfirming}
                                                className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/50 text-red-400 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                                            >
                                                BET FAKE ❌
                                            </button>
                                        </div>
                                        {(isPending || isConfirming) && <p className="text-center text-xs text-blue-400 animate-pulse">Confirming transaction...</p>}
                                    </>
                                )}
                            </div>
                        )
                    ) : (
                        // MARKET IS RESOLVED
                        <div className="mt-2 pt-4 border-t border-gray-800">
                            {hasPlacedBet ? (
                                // User had a bet
                                userWon ? (
                                    // USER WON
                                    <div className="space-y-3">
                                        <div className="bg-green-950/30 border border-green-700/50 rounded-xl p-4 text-center">
                                            <p className="text-2xl mb-1">🏆</p>
                                            <p className="text-green-400 font-black text-lg">YOU WON!</p>
                                            <p className="text-gray-400 text-xs mt-1">
                                                You bet {formatEther(userBetAmount)} ETH on {userBetSide ? "REAL" : "FAKE"} — correct!
                                            </p>
                                            <p className="text-green-300 font-bold text-lg mt-2">
                                                Payout: {formatEther((userBetAmount * BigInt(3)) / BigInt(2))} ETH
                                            </p>
                                            <p className="text-green-600 text-xs">
                                                ({formatEther(userBetAmount)} bet + {formatEther(userBetAmount / BigInt(2))} reward)
                                            </p>
                                        </div>
                                        {hasClaimed || isTxSuccess ? (
                                            <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 text-center">
                                                <p className="text-green-400 text-sm font-bold">✅ {formatEther((userBetAmount * BigInt(3)) / BigInt(2))} ETH claimed to your wallet!</p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleClaim}
                                                disabled={isPending || isConfirming}
                                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-white transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)] animate-pulse disabled:opacity-50"
                                            >
                                                {isPending || isConfirming ? "CLAIMING..." : `💰 CLAIM ${formatEther((userBetAmount * BigInt(3)) / BigInt(2))} ETH`}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    // USER LOST
                                    <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4 text-center">
                                        <p className="text-2xl mb-1">💀</p>
                                        <p className="text-red-400 font-black text-lg">YOU LOST</p>
                                        <p className="text-gray-500 text-xs mt-1">
                                            You bet {formatEther(userBetAmount)} ETH on {userBetSide ? "REAL" : "FAKE"} — wrong guess.
                                        </p>
                                    </div>
                                )
                            ) : (
                                // User didn't bet
                                <div className="text-center py-4">
                                    <p className="text-gray-500 text-sm">You didn&apos;t place a bet on this market.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
                    onClick={() => setIsFullscreen(false)}
                >
                    <div className="relative max-w-7xl max-h-screen">
                        <button
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 font-bold text-xl bg-gray-800/50 rounded-full w-10 h-10 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
                        >✕</button>
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
