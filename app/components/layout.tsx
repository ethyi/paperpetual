import Head from "next/head";
import Link from "next/link";
import React from "react";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <Head>
        <title>Paperpetual</title>
        <meta name="description" content="Trade perpetuals without the risk!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="text-center p-14">
        <h1 className="text-7xl font-bold ">Paperpetual</h1>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center p-2 bg-gray-200 ">
        <a
          className="no-underline hover:underline"
          href="https://ethyi.de/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Made by ethyi &copy; {new Date().getFullYear()}
        </a>
      </footer>
    </div>
  );
}

export default Layout;
