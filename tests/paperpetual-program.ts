import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { PaperpetualProgram } from "../target/types/paperpetual_program";
const SOL = anchor.web3.LAMPORTS_PER_SOL;

async function airdrop(publicKey: PublicKey, amount: number) {
  const connection = anchor.getProvider().connection;
  const latestBlockHash = await connection.getLatestBlockhash();
  let signature = await connection.requestAirdrop(publicKey, amount * SOL);
  let confirmation = await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature,
  });
  console.log("Airdrop finished: " + publicKey.toBase58());
}
async function printBalance(publicKey: PublicKey) {
  const connection = anchor.getProvider().connection;
  console.log((await connection.getBalance(publicKey)) / LAMPORTS_PER_SOL);
}

describe("paperpetual-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .PaperpetualProgram as Program<PaperpetualProgram>;

  const walletKeypair = anchor.AnchorProvider.env().wallet;

  const userKeypair = anchor.web3.Keypair.generate();

  const buyingPower = 9690.12;
  const portfolio = [200, 10, 0, 0, 0, 0];
  it("Is initialized!", async () => {
    await airdrop(userKeypair.publicKey, 1);

    const [tradeAccountPDA, _] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("trade"),
        userKeypair.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .initialize(buyingPower, portfolio)
      .accounts({
        tradeAccount: tradeAccountPDA,
        authority: userKeypair.publicKey,
      })
      .signers([userKeypair])
      .rpc();

    expect(
      (await program.account.tradeAccount.fetch(tradeAccountPDA)).buyingPower
    ).to.equal(buyingPower);

    await program.methods
      .update(buyingPower + 1, portfolio)
      .accounts({
        tradeAccount: tradeAccountPDA,
        authority: userKeypair.publicKey,
      })
      .signers([userKeypair])
      .rpc();

    expect(
      (await program.account.tradeAccount.fetch(tradeAccountPDA)).buyingPower
    ).to.equal(buyingPower + 1);
  });
});
