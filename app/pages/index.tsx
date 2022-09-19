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
import { setCookie, getCookie, hasCookie, deleteCookie } from "cookies-next";

import { WalletNotConnectedError } from "@solana/wallet-adapter-base";

import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  AnchorWallet,
  ConnectionContextState,
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  Connection,
} from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  web3,
  utils,
  BN,
  Idl,
} from "@project-serum/anchor";

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
const portfolioIndices = ["BTC-PERP", "ETH-PERP", "SOL-PERP"];
const portfolioFields: { [key: string]: number } = {
  "BTC-PERP": 0,
  "ETH-PERP": 1,
  "SOL-PERP": 2,
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

interface Portfolio {
  [key: string]: { amount: number; average: number };
}
interface Balance {
  balance: number;
  buyingPower: number;
  pnl: number;
  currentPortfolio: number;
  initialPortfolio: number;
}

const idl: Idl = require("../public/idl.json");
const utf8 = utils.bytes.utf8;

const Home: NextPage = () => {
  const [isWallet, setIsWallet] = useState(hasCookie("wallet"));
  const [isInitialize, setIsInitialize] = useState(false);
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  let initPortfolio = {};
  let initBalance = {
    balance: 10000,
    buyingPower: 10000,
    pnl: 0,
    currentPortfolio: 0,
    initialPortfolio: 0,
  };
  const [portfolio, setPortfolio] = useState<Portfolio>(initPortfolio);
  let [userBalance, setUserBalance] = useState<Balance>(initBalance);

  const [amount, setAmount] = useState("");
  const [amountErr, setAmountErr] = useState(false);
  const [isBuy, setIsBuy] = useState(true);
  const [pair, setPair] = useState("BTC-PERP");

  const { allData, allLoading, allError } = useAllData();

  let isLoading = allLoading;
  let isError = allError;
  let data = allData[pair];

  async function getTradeAccount(anchorWallet: AnchorWallet) {
    const provider = new AnchorProvider(connection, anchorWallet, {
      preflightCommitment: "confirmed",
    });
    const program = new Program(idl, idl.metadata.address, provider);
    const [tradePDA] = await web3.PublicKey.findProgramAddress(
      [utf8.encode("trade"), anchorWallet.publicKey.toBuffer()],
      program.programId
    );

    const tradeAccount = await program.account.tradeAccount.fetchNullable(
      tradePDA
    );
    return tradeAccount;
  }
  useEffect(() => {
    const getInitialAccount = async function (
      isWallet: boolean,
      connection: Connection,
      anchorWallet?: AnchorWallet
    ) {
      let initPortfolio: Portfolio = {};
      let initBalance = {
        balance: 10000,
        buyingPower: 10000,
        pnl: 0,
        currentPortfolio: 0,
        initialPortfolio: 0,
      };
      if (isWallet && anchorWallet) {
        const provider = new AnchorProvider(connection, anchorWallet, {
          preflightCommitment: "confirmed",
        });
        const program = new Program(idl, idl.metadata.address, provider);
        const [tradePDA] = await web3.PublicKey.findProgramAddress(
          [utf8.encode("trade"), anchorWallet.publicKey.toBuffer()],
          program.programId
        );

        const tradeAccount = await program.account.tradeAccount.fetchNullable(
          tradePDA
        );
        if (tradeAccount === null) {
          setIsInitialize(false);
          return;
        }
        setIsInitialize(true);
        if (
          typeof tradeAccount.buyingPower != "number" ||
          typeof tradeAccount.portfolio != "object" ||
          tradeAccount.portfolio === null
        ) {
          console.error;
          return;
        }

        const accBuyingPower: number = tradeAccount.buyingPower;

        const accPortfolio = tradeAccount.portfolio as number[];

        initBalance = { ...initBalance, buyingPower: accBuyingPower };
        portfolioIndices.forEach(function (value, i) {
          let index = 2 * i;

          if (accPortfolio[index] === 0) return;
          initPortfolio[value] = {
            amount: accPortfolio[index],
            average: accPortfolio[index + 1],
          };
        });
        console.log(initPortfolio);
      } else if (hasCookie("portfolio") && hasCookie("balance")) {
        let [tempPort, tempBalance] = [
          getCookie("portfolio"),
          getCookie("balance"),
        ];
        if (tempPort && tempBalance) {
          initPortfolio = JSON.parse(tempPort.toString());
          initBalance = JSON.parse(tempBalance.toString());
        }
      }
      console.log(initPortfolio);
      console.log(initBalance);
      setPortfolio(initPortfolio);
      setUserBalance(initBalance);
    };
    getInitialAccount(isWallet, connection, anchorWallet).catch(console.error);
  }, [connection, anchorWallet, isWallet]);
  async function initialize() {
    let inputBuyingPower = 10000;
    let inputPortfolio = [0, 0, 0, 0, 0, 0];
    if (!anchorWallet) return;
    const provider = new AnchorProvider(connection, anchorWallet, {
      preflightCommitment: "confirmed",
    });
    console.log(idl.metadata);
    console.log(idl);
    // let programID = new PublicKey(')
    const program = new Program(idl, idl.metadata.address, provider);
    try {
      const [tradePDA] = await web3.PublicKey.findProgramAddress(
        [utf8.encode("trade"), anchorWallet.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initialize(inputBuyingPower, inputPortfolio)
        .accounts({
          tradeAccount: tradePDA,
          authority: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const tradeAccount = await program.account.tradeAccount.fetchNullable(
        tradePDA
      );
      if (tradeAccount === null) {
        setIsInitialize(false);
        return;
      }
      setIsInitialize(true);
      if (
        typeof tradeAccount.buyingPower != "number" ||
        typeof tradeAccount.portfolio != "object" ||
        tradeAccount.portfolio === null
      ) {
        console.error;
        return;
      }

      const accBuyingPower: number = tradeAccount.buyingPower;
      const accPortfolio = tradeAccount.portfolio as number[];
      console.log("tradeAccount");

      let tradeBalance = { ...userBalance, buyingPower: accBuyingPower };
      let tradePortfolio: Portfolio = {};
      portfolioIndices.forEach(function (value, i) {
        let index = 2 * i;

        if (accPortfolio[index] === 0) return;
        tradePortfolio[value] = {
          amount: accPortfolio[index],
          average: accPortfolio[index + 1],
        };
      });
      setUserBalance(tradeBalance);
      setPortfolio(tradePortfolio);
    } catch (err) {
      console.log(err);
    }
  }

  async function update(inputBuyingPower: number, inputPortfolio: number[]) {
    // let inputBuyingPower = 10000;
    // let inputPortfolio = [0, 0, 0, 0, 0, 0];
    if (!anchorWallet) return;
    const provider = new AnchorProvider(connection, anchorWallet, {
      preflightCommitment: "confirmed",
    });
    const program = new Program(idl, idl.metadata.address, provider);
    try {
      const [tradePDA] = await web3.PublicKey.findProgramAddress(
        [utf8.encode("trade"), anchorWallet.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .update(inputBuyingPower, inputPortfolio)
        .accounts({
          tradeAccount: tradePDA,
          authority: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      const tradeAccount = await program.account.tradeAccount.fetch(tradePDA);
      console.log("tradeAccount", tradeAccount);
    } catch (err) {
      console.log(err);
    }
  }
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

  async function handleExecute(e: React.FormEvent) {
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

      let amount = num;
      let average = data.ask;
      if (data.name in portfolio) {
        amount = oldValue.amount + num;
        average =
          amount / (oldValue.amount / oldValue.average + num / data.ask);
      }

      let newBuyingPower = userBalance.buyingPower - num;
      if (isWallet && anchorWallet) {
        let initPortfolio = [0, 0, 0, 0, 0, 0];
        Object.entries(portfolio).map(([key, { amount, average }], i) => {
          let index = 2 * portfolioFields[key];
          initPortfolio[index] = amount;
          initPortfolio[index + 1] = average;
        });
        initPortfolio[2 * portfolioFields[data.name]] = amount;
        initPortfolio[2 * portfolioFields[data.name] + 1] = average;
        await update(newBuyingPower, initPortfolio);
      }
      let newUserBalance = {
        ...userBalance,
        buyingPower: newBuyingPower,
      };
      let newPortfolio = {
        ...portfolio,
        [data.name]: {
          amount,
          average,
        },
      };
      setUserBalance(newUserBalance);
      setPortfolio(newPortfolio);

      if (!isWallet) {
        setCookie("portfolio", newPortfolio, { sameSite: true });
        setCookie("balance", newUserBalance, { sameSite: true });
      }
      return;
    }
    if (!isBuy && data.name in portfolio) {
      let current = (data.bid * oldValue.amount) / oldValue.average;
      num = Math.min(num, current);
      setAmount(num.toString());
      setAmountErr(false);

      let amount = oldValue.amount - oldValue.average * (num / data.bid);
      let average = oldValue.average;

      let temp = { ...portfolio };
      if (amount <= 0) {
        delete temp[data.name];
      } else {
        temp[data.name] = {
          amount,
          average,
        };
      }
      let newBuyingPower = userBalance.buyingPower + num;

      if (isWallet && anchorWallet) {
        let initPortfolio = [0, 0, 0, 0, 0, 0];
        Object.entries(temp).map(([key, { amount, average }], i) => {
          let index = 2 * portfolioFields[key];
          initPortfolio[index] = amount;
          initPortfolio[index + 1] = average;
        });

        await update(newBuyingPower, initPortfolio);
      }
      let newUserBalance = {
        ...userBalance,
        buyingPower: newBuyingPower,
      };
      let newPortfolio = temp;
      setUserBalance(newUserBalance);
      setPortfolio(newPortfolio);
      if (!isWallet) {
        setCookie("portfolio", newPortfolio, { sameSite: true });
        setCookie("balance", newUserBalance, { sameSite: true });
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
        {isWallet && (
          <>
            <Button variant="contained">
              <WalletMultiButton />
            </Button>
            <WalletDisconnectButton />
          </>
        )}
        <div>
          <Button
            variant={isWallet ? "outlined" : "contained"}
            onClick={() => {
              deleteCookie("wallet");
              setIsWallet(false);
            }}
            color="secondary"
          >
            Use Cookies
          </Button>
          <Button
            variant={isWallet ? "contained" : "outlined"}
            onClick={() => {
              setCookie("wallet", true, { sameSite: true });
              setIsWallet(true);
            }}
            color="secondary"
          >
            Use Wallet
          </Button>
        </div>
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
            {(!isWallet || (isWallet && isInitialize)) && (
              <Button variant="outlined" onClick={handleExecute}>
                Execute market {isBuy ? "buy" : "sell"}
              </Button>
            )}
            {isWallet && !isInitialize && (
              <Button variant="outlined" onClick={initialize}>
                Initialize to trade with SOL Wallet
              </Button>
            )}
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
