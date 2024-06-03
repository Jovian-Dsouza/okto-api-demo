"use client";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect } from "react";

export function LoginButton() {
  const { data: session } = useSession();

  const handleLogin = () => {
    session ? signOut() : signIn();
  };

  useEffect(() => {
    if (session && session.id_token) {
      console.log("Session id_token", session.id_token);
    }
  }, [session]);

  return (
    <button
      className={`font-bold border border-transparent rounded-xl px-4 py-2 transition-colors ${
        session
          ? "bg-red-500 hover:bg-red-700 text-white"
          : "bg-blue-500 hover:bg-blue-700 text-white"
      }`}
      onClick={handleLogin}
    >
      {session ? "Log Out" : "Log In"}
    </button>
  );
}
