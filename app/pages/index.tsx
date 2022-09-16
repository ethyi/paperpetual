import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { NextPage } from "next";
import { stringify } from "querystring";
import React, { ReactEventHandler, useEffect, useRef, useState } from "react";
import Layout from "../components/layout";
import useSWR from "swr";
import { Input } from "@mui/material";
import { createSecureContext } from "tls";
import { setCookie, getCookie, hasCookie, setCookies } from "cookies-next";

import { WalletNotConnectedError } from "@solana/wallet-adapter-base";

import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { FC, useCallback } from "react";

export const SendSOLToRandomAddress: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const onClick = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();

    let fundingAddress = publicKey;
    let tradeAccountAddress = Keypair.generate();
    const keys = [
      {
        pubkey: fundingAddress,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: tradeAccountAddress,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ];
    const programId = "CKGGMgd8CQgJMRhUYjai2F8QwAGKKsaDz559PbUghjbS";
    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys,
        programId,
        data: Buffer.from([10000, [0, 0, 0, 0, 0, 0]]),
      })
    );

    const {
      context: { slot: minContextSlot },
      value: { blockhash, lastValidBlockHeight },
    } = await connection.getLatestBlockhashAndContext();

    const signature = await sendTransaction(transaction, connection, {
      minContextSlot,
    });

    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    });
  }, [publicKey, sendTransaction, connection]);

  return (
    <button onClick={onClick} disabled={!publicKey}>
      Send SOL to a random address!
    </button>
  );
};
const fetcher = async (
  input: RequestInfo,
  init: RequestInit,
  ...args: any[]
) => {
  const res = await fetch(input, init);
  return res.json();
};

const pairs = {
  FTX: [
    ["ftx/futures/BTC-PERP", "BTC-PERP"],
    ["ftx/futures/ETH-PERP", "ETH-PERP"],
    ["ftx/futures/SOL-PERP", "SOL-PERP"],
  ],
};
interface APIData {
  name: string;
  volume: string;
  change: number;
  ask: number;
  last: number;
  bid: number;
  source: string;
}
const Home: NextPage = () => {
  interface Portfolio {
    [key: string]: { amount: number; average: number };
  }
  let initPortfolio = {};
  let initBalance = {
    balance: 10000,
    buyingPower: 10000,
    pnl: 0,
    currentPortfolio: 0,
    initialPortfolio: 0,
  };

  if (hasCookie("portfolio") && hasCookie("balance")) {
    let [tempPort, tempBalance] = [
      getCookie("portfolio"),
      getCookie("balance"),
    ];
    if (tempPort && tempBalance) {
      initPortfolio = JSON.parse(tempPort.toString());
      initBalance = JSON.parse(tempBalance.toString());
    }

    // initPortfolio = tempPort;
    // if (!!tempBalance) initBalance = tempBalance;
  }
  const [portfolio, setPortfolio] = useState<Portfolio>(initPortfolio);
  // get from cookies or wallet
  let [userBalance, setUserBalance] = useState(initBalance);
  setCookie("portfolio", portfolio);
  setCookie("balance", userBalance);

  // const amount = useRef("");
  const [amount, setAmount] = useState("");
  const [amountErr, setAmountErr] = useState(false);
  const [isBuy, setIsBuy] = useState(true);
  const [pair, setPair] = useState("BTC-PERP");
  // const { data, isLoading, isError } = useFTX(pair);
  const { allData, allLoading, allError } = useAllData();
  let isLoading = allLoading;
  let isError = allError;
  let data = allData[pair];

  function useAllData() {
    let allData: { [key: string]: APIData } = {};
    let err = false;
    Object.entries(pairs).forEach(([exchange, exchangePairs], index) => {
      exchangePairs.forEach(([pairUrl, pairName], index) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        let { data, error } = useSWR(pairUrl, fetcher, {
          refreshInterval: 2000,
        });
        let allLoading = !error && !data;
        if (allLoading || error) {
          err = true;
          return;
        }
        data = data.result;

        data = {
          name: data.name,
          volume: Math.round(data.volumeUsd24h).toLocaleString(),
          change: (parseFloat(data.change24h) * 100).toFixed(2),
          ask: data.ask,
          last: data.last,
          bid: data.bid,
          source: "FTX",
        };

        allData[pairName] = data;
      });
    });
    if (err) {
      return {
        allData: {},
        allLoading: false,
        allError: false,
      };
    }
    updateUserBalance(allData);
    return { allData, allLoading: false, allError: false };
  }
  function updateUserBalance(updatedData: { [key: string]: APIData }) {
    const currentPortfolio = Object.entries(portfolio).reduce(
      (acc, [key, value]) => {
        return acc + (value.amount / value.average) * updatedData[key].last;
      },
      0
    );
    const initialPortfolio = Object.entries(portfolio).reduce(
      (acc, [key, value]) => {
        return acc + value.amount;
      },
      0
    );
    const balance = currentPortfolio + userBalance.buyingPower;
    const buyingPower = userBalance.buyingPower;
    const pnl = balance - 10000;
    userBalance = {
      balance,
      buyingPower,
      pnl,
      currentPortfolio,
      initialPortfolio,
    };
  }

  function handleExecute(e: React.FormEvent) {
    e.preventDefault();
    let num = +amount;

    if (!num || num <= 0) {
      setAmountErr(true);
      return;
    }

    let oldValue = portfolio[data.name];
    if (isBuy && userBalance.buyingPower > 0) {
      num = Math.min(num, userBalance.buyingPower);
      setAmount(num.toString());
      setAmountErr(false);
      setUserBalance({
        ...userBalance,
        buyingPower: userBalance.buyingPower - num,
      });
      if (data.name in portfolio) {
        let amount = oldValue.amount + num;
        let average =
          amount / (oldValue.amount / oldValue.average + num / data.ask);
        setPortfolio((prev) => ({
          ...prev,
          [data.name]: {
            amount,
            average,
          },
        }));
      } else {
        setPortfolio((prev) => ({
          ...prev,
          [data.name]: {
            amount: num,
            average: data.ask,
          },
        }));
      }
      return;
    }
    if (!isBuy && data.name in portfolio) {
      let current = (data.bid * oldValue.amount) / oldValue.average;
      num = Math.min(num, current);
      setAmount(num.toString());
      setAmountErr(false);

      setUserBalance({
        ...userBalance,
        buyingPower: userBalance.buyingPower + num,
      });
      let amount = oldValue.amount - oldValue.average * (num / data.bid);
      let average = oldValue.average;
      if (amount <= 0) {
        let temp = portfolio;
        delete temp[data.name];
        setPortfolio({ ...temp });
      } else {
        setPortfolio((prev) => ({
          ...prev,
          [data.name]: {
            amount,
            average,
          },
        }));
      }
      return;
    }
    setAmountErr(true);
  }
  if (isError || allError) {
    return <div>failed to load</div>;
  }
  if (isLoading || allLoading || !data || !allData)
    return <div>loading...</div>;
  return (
    <Layout>
      <div className="p-16 px-96 h-full">
        <Button variant="contained">
          <WalletMultiButton />
        </Button>
        <SendSOLToRandomAddress />
        <WalletDisconnectButton />

        <div className="border border-black w-full h-full grid gap-4">
          <div
            key="stats"
            className="row-start-1 row-span-3 col-start-1 col-end-2 flex flex-col justify-center"
          >
            <div>
              {Object.entries(pairs).map(([exchange, exchangePairs], index) => (
                <div key={exchange}>
                  {exchange}:
                  {exchangePairs.map(([pairUrl, pairName], index) => (
                    <Button
                      variant={pairName === pair ? "contained" : "outlined"}
                      key={exchange + index}
                      onClick={(e) =>
                        setPair((e.target as HTMLButtonElement).value)
                      }
                      value={pairName}
                    >
                      {`${pairName}: ${allData[pairName]?.last} Vol:${allData[pairName]?.volume}, Change: ${allData[pairName]?.change}`}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <div className="border border-black">TICKER: {data.name}</div>
            <div className="border border-black">
              24h volume: ${data.volume}
            </div>
            <div className="border border-black">
              24h change: {data.change}%
            </div>
            <div className="border border-black">ASK: ${data.ask}</div>
            <div className="border border-black">Last price: ${data.last}</div>
            <div className="border border-black">BID: ${data.bid}</div>
            <div className="border border-black">Source: {data.source}</div>
          </div>
          <form
            key="form"
            className="row-start-1 row-end-2 col-start-2 col-end-3 h-full  p-4 flex flex-col text-center"
            onSubmit={handleExecute}
          >
            <div className="flex justify-center">
              <Button
                variant={isBuy ? "contained" : "outlined"}
                color="success"
                onClick={() => {
                  setIsBuy(true);
                }}
              >
                Buy
              </Button>
              <Button
                variant={!isBuy ? "contained" : "outlined"}
                color="error"
                onClick={() => {
                  setIsBuy(false);
                }}
              >
                Sell
              </Button>
            </div>
            {!amountErr ? (
              <TextField
                id="filled-basic"
                label="Amount in USD"
                variant="filled"
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                value={amount}
              />
            ) : (
              <TextField
                error
                id="filled-error-helper-text"
                label="Error"
                defaultValue="Hello World"
                helperText="Enter a valid number"
                variant="filled"
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                value={amount}
              />
            )}

            <Button variant="outlined" onClick={handleExecute}>
              Execute market {isBuy ? "buy" : "sell"}
            </Button>
          </form>
          <div
            key="balance"
            className="row-start-2 row-end-4 col-start-2 col-end-3 h-full"
          >
            <>
              <div>Total Balance: {userBalance.balance}</div>
              <div>Buying power: {userBalance.buyingPower}</div>
              <div>PnL: {userBalance.pnl}</div>
              <div>Current Portfolio Value: {userBalance.currentPortfolio}</div>
              <div>Initial Portfolio Value: {userBalance.initialPortfolio}</div>
              <div className="text-2xl">Portfolio</div>
              {Object.entries(portfolio).map(([token, value]) => (
                <div key={token}>{`${token}: ${
                  value.amount / value.average
                }, average ${value.average}, current: ${
                  (allData[token].last * value.amount) / value.average
                }, initial: ${value.amount}, positon pnl: ${
                  (allData[token].last * value.amount) / value.average -
                  value.amount
                }`}</div>
              ))}
            </>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
