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

const fetcher = async (
  input: RequestInfo,
  init: RequestInit,
  ...args: any[]
) => {
  const res = await fetch(input, init);
  return res.json();
};

const Home: NextPage = () => {
  interface Portfolio {
    [key: string]: { amount: number; average: number };
  }
  const [portfolio, setPortfolio] = useState<Portfolio>({});
  // get from cookies or wallet
  let [userBalance, setUserBalance] = useState({
    balance: 10000,
    buyingPower: 10000,
    pnl: 0,
    currentPortfolio: 0,
    initialPortfolio: 0,
  });

  const amount = useRef("");
  const [amountErr, setAmountErr] = useState(false);
  const [isBuy, setIsBuy] = useState(true);
  const { data, isLoading, isError } = useFTX();
  function useFTX() {
    let { data, error } = useSWR("/api/ftx/markets/ETH/USD", fetcher, {
      refreshInterval: 100,
    });
    let isLoading = !error && !data;
    if (isLoading) {
      return {
        data: {},
        isLoading,
        isError: error,
      };
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
    let updatedData = { [data.name]: data.last };
    updateUserBalance(updatedData);
    return {
      data,
      isLoading,
      isError: error,
    };
  }
  function updateUserBalance(updatedData: { [key: string]: number }) {
    const currentPortfolio = Object.entries(portfolio).reduce(
      (acc, [key, value]) => {
        return acc + (value.amount / value.average) * updatedData[key];
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
    let num = +amount.current;
    console.log(num);
    console.log(typeof num);
    if (!num || num <= 0) {
      setAmountErr(true);
      return;
    }

    let oldValue = portfolio[data.name];
    if (isBuy) {
      num = Math.min(num, userBalance.buyingPower);
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
    let current = (data.bid * oldValue.amount) / oldValue.average;
    if (!isBuy) {
      num = Math.min(num, current);
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

  if (isError) {
    return <div>failed to load</div>;
  }
  if (isLoading) return <div>loading...</div>;

  return (
    <Layout>
      <div className="p-16 px-96 h-full">
        <div className="border border-black w-full h-full grid gap-4">
          <div
            key="stats"
            className="row-start-1 row-span-3 col-start-1 col-end-2 flex flex-col justify-center"
          >
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
                  amount.current = e.target.value;
                }}
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
                  amount.current = e.target.value;
                }}
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
                  (data.last * value.amount) / value.average
                }, initial: ${value.amount}, positon pnl: ${
                  (data.last * value.amount) / value.average - value.amount
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
