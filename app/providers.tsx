"use client";
import React, { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { OktoProvider } from "./okto/OktoProvider";
import { BuildType } from "./okto/types";
import { Session } from "next-auth";

function AppProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <OktoProvider
      apiKey={process.env.NEXT_PUBLIC_OKTO_CLIENT_API!}
      buildType={BuildType.SANDBOX}
    >
      <SessionProvider session={session}>{children}</SessionProvider>
    </OktoProvider>
  );
}

export default AppProvider;
