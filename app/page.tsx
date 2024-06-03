"use client";
import { useEffect, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LoginButton } from "./components/LoginButton";
import { useOkto } from "./hooks/useOkto";
import { BuildType } from "./hooks/types";
import GetButton from "./components/GetButton";
import TransferTokens from "./components/TransferTokens";

export default function Home() {
  const { data: session } = useSession();
  const {
    isLoggedIn,
    authenticate,
    logOut,
    getPortfolio,
    transferTokens,
    getWallets,
    createWallet,
  } = useOkto(process.env.NEXT_PUBLIC_OKTO_CLIENT_API!, BuildType.SANDBOX);
  const idToken = useMemo(() => (session ? session.id_token : null), [session]);

  useEffect(() => {
    if (!idToken) {
      logOut();
      return;
    }
    authenticate(idToken, (result: any, error: any) => {
      if (result) {
        console.log("Authentication successful");
      }
      if (error) {
        console.error("Authentication error:", error);
        signOut();
      }
    });
  }, [idToken]);

  return (
    <main className="flex min-h-screen flex-col items-center space-y-5 p-24">
      <div className="text-white font-bold text-2xl">Okto SDK API</div>
      <LoginButton />
      <GetButton title="Get Portfolio" apiFn={getPortfolio} />
      <GetButton title="Create Wallet" apiFn={createWallet} />
      <GetButton title="Get Wallets" apiFn={getWallets} />
      <TransferTokens apiFn={transferTokens} />
    </main>
  );
}
