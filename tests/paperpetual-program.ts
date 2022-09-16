import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { PaperpetualProgram } from "../target/types/paperpetual_program";
const SOL = anchor.web3.LAMPORTS_PER_SOL;
describe("paperpetual-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .PaperpetualProgram as Program<PaperpetualProgram>;
  const tradeAccountKeyPair = anchor.web3.Keypair.generate();
  // the user
  const authority = anchor.AnchorProvider.env().wallet;
  const buyingPower = 9690.12;
  const portfolio = [200, 10, 0, 0, 0, 0];
  it("Is initialized!", async () => {
    // Add your test here.

    const tx = await program.methods
      .initialize(buyingPower, portfolio)
      .accounts({
        tradeAccount: tradeAccountKeyPair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tradeAccountKeyPair])

      .rpc();
    console.log("Your transaction signature", tx);
    let tradeAccount = await program.account.tradeAccount.fetch(
      tradeAccountKeyPair.publicKey
    );
    expect(tradeAccount.buyingPower).to.equal(buyingPower);
    expect(tradeAccount.portfolio).to.eql(portfolio);
    expect(tradeAccount.authority).to.eql(authority.publicKey);
  });

  it("Can updated Data", async () => {
    const updatedBuyingPower = 10000;
    const updatedPortfolio = [200, 10, 200, 10, 0, 0];
    const tx = await program.methods
      .update(updatedBuyingPower, updatedPortfolio)
      .accounts({
        tradeAccount: tradeAccountKeyPair.publicKey,
        signer: authority.publicKey,
      })
      .signers([])
      .rpc();
    console.log("Your transaction signature", tx);
    let tradeAccount = await program.account.tradeAccount.fetch(
      tradeAccountKeyPair.publicKey
    );
    expect(tradeAccount.buyingPower).to.equal(updatedBuyingPower);
    expect(tradeAccount.portfolio).to.eql(updatedPortfolio);
    expect(tradeAccount.authority).to.eql(authority.publicKey);
  });
});
