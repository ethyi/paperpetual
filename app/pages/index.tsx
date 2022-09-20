import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { NextPage } from "next";
import { stringify } from "querystring";
import React, { ReactEventHandler, useEffect, useRef, useState } from "react";
import Layout from "../components/layout";
import useSWR from "swr";
import {
  Input,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
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
  const [amountErr, setAmountErr] = useState("");
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

      let tradeBalance = { ...userBalance, buyingPower: accBuyingPower };
      let tradePortfolio: Portfolio = {};
      portfolioIndices.forEach(function (value, i) {
        let index = 2 * i;

        if (accPortfolio[index] === 0) return;
        tradePortfolio[value] = {
          amount: +accPortfolio[index],
          average: +accPortfolio[index + 1],
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
          ask: data.ask.toFixed(2),
          last: data.last.toFixed(2),
          bid: data.bid.toFixed(2),
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
      setAmountErr("Expected a positive number");
      return;
    }

    let oldValue = portfolio[data.name];
    if (isBuy) {
      if (userBalance.buyingPower <= 0) {
        setAmountErr("Insufficient Buying Power");
        return;
      }
      num = Math.min(num, userBalance.buyingPower);
      setAmount(num.toString());

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
          initPortfolio[index] = +amount;
          initPortfolio[index + 1] = +average;
        });
        initPortfolio[2 * portfolioFields[data.name]] = +amount;
        initPortfolio[2 * portfolioFields[data.name] + 1] = +average;
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
    } else {
      if (!(data.name in portfolio)) {
        setAmountErr("Asset not owned");
        return;
      }
      let current = (data.bid * oldValue.amount) / oldValue.average;
      num = Math.min(num, current);
      setAmount(num.toString());

      let amount = oldValue.amount - oldValue.average * (num / data.bid);
      let average = oldValue.average;

      let temp = { ...portfolio };
      if (+amount.toFixed(4) <= 0) {
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
    }
    setAmountErr("");
  }
  if (isError || allError) {
    return <div>failed to load</div>;
  }
  if (isLoading || allLoading || !data || !allData)
    return <div>loading...</div>;

  return (
    <Layout>
      <div className=" mt-14 m-auto max-w-6xl ">
        <h2 className="text-md pb-2">Data Storage Method</h2>
        <div className="flex items-end">
          <Button
            variant={isWallet ? "outlined" : "contained"}
            onClick={() => {
              deleteCookie("wallet");
              setIsWallet(false);
            }}
            color="secondary"
          >
            Cookies
          </Button>
          <div className="ml-4"></div>
          <Button
            variant={isWallet ? "contained" : "outlined"}
            onClick={() => {
              setCookie("wallet", true, { sameSite: true });
              setIsWallet(true);
            }}
            color="secondary"
          >
            Devnet Solana Wallet
          </Button>
          <div className="flex-1"></div>
          {isWallet && (
            <>
              <WalletMultiButton />
              <div className="ml-4"></div>
              <WalletDisconnectButton />
            </>
          )}
        </div>
        <div className="border border-black w-full h-full grid gap-4">
          <div
            key="stats"
            className="row-start-1 row-span-3 col-start-1 col-end-2 flex flex-col items-center p-8"
          >
            <div className="flex">
              {Object.entries(pairs).map(([exchange, exchangePairs], index) => (
                <div key={exchange} className="flex-1 flex flex-col">
                  <h2 className="text-xl">{exchange}</h2>
                  {exchangePairs.map(([pairUrl, pairName], index) => (
                    <Button
                      variant={pairName === pair ? "contained" : "outlined"}
                      key={exchange + index}
                      onClick={(e) =>
                        setPair((e.target as HTMLButtonElement).value)
                      }
                      value={pairName}
                    >
                      {`${pairName}: $${allData[pairName]?.last} | 24H Vol: $${allData[pairName]?.volume} | 24H %: ${allData[pairName]?.change}%`}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-8 ">
              <TableContainer component={Paper}>
                <Table aria-label="simple table">
                  <TableBody>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Ticker
                      </TableCell>
                      <TableCell align="right">{data.name}</TableCell>
                    </TableRow>

                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        24H Volume
                      </TableCell>
                      <TableCell align="right">${data.volume}</TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        24H Change
                      </TableCell>
                      <TableCell align="right">{data.change}%</TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Ask
                      </TableCell>
                      <TableCell align="right">${data.ask}</TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Last
                      </TableCell>
                      <TableCell align="right">${data.last}</TableCell>
                    </TableRow>

                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Bid
                      </TableCell>
                      <TableCell align="right">${data.bid}</TableCell>
                    </TableRow>

                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Source
                      </TableCell>
                      <TableCell align="right">{data.source}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          </div>
          <form
            key="form"
            className="row-start-1 row-end-2 col-start-2 col-end-3 h-full  p-8 pb-0 flex flex-col text-center"
            onSubmit={handleExecute}
          >
            <div className="flex justify-center">
              <Button
                variant={isBuy ? "contained" : "outlined"}
                color="success"
                onClick={() => {
                  setIsBuy(true);
                }}
                className="flex-1"
              >
                Buy
              </Button>
              <Button
                variant={!isBuy ? "contained" : "outlined"}
                color="error"
                className="flex-1"
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
                defaultValue="Input Error"
                helperText={amountErr}
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
            className="row-start-2 row-end-4 col-start-2 col-end-3 h-full p-8 pt-0"
          >
            <>
              <h2 className="text-xl py-4">User Balance</h2>
              <TableContainer component={Paper}>
                <Table aria-label="simple table">
                  <TableBody>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Total Balance
                      </TableCell>
                      <TableCell align="right">
                        ${userBalance.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        Buying Power
                      </TableCell>
                      <TableCell align="right">
                        ${userBalance.buyingPower.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        PNL
                      </TableCell>
                      <TableCell align="right">
                        $ {userBalance.pnl.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <h2 className="text-xl py-4">Positions</h2>
              <TableContainer component={Paper}>
                <Table
                  // sx={{ minWidth: 650 }}
                  size="small"
                  aria-label="a dense table"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Ticker</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Amount ($)</TableCell>
                      <TableCell align="right">Average ($)</TableCell>
                      <TableCell align="right">PNL ($)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(portfolio).map(([token, value]) => (
                      <TableRow
                        key={token}
                        sx={{
                          "&:last-child td, &:last-child th": { border: 0 },
                        }}
                      >
                        <TableCell component="th" scope="row">
                          {token}
                        </TableCell>
                        <TableCell align="right">
                          {(value.amount / value.average).toFixed(4)}
                        </TableCell>
                        <TableCell align="right">
                          {(
                            (value.amount / value.average) *
                            allData[token].last
                          ).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {(+value.average).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {(
                            (allData[token].last * value.amount) /
                              value.average -
                            value.amount
                          ).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
