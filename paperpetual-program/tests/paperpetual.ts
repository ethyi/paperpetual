import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Paperpetual } from "../target/types/paperpetual";

describe("paperpetual", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Paperpetual as Program<Paperpetual>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
