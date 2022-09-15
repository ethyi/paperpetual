use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

/**
 * Index references
 * 0/ BTC-PERP  [amount (USD), average]
 * 1/ ETH-PERP
 * 2/ SOL-PERP
 */
const MAX_SIZE: usize = 8 + 32 + 8 + (8 + 8) * (3);
#[error_code]
pub enum Error {
    InvalidAuthority,
}

#[program]
pub mod paperpetual_program {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        buying_power: f64,
        portfolio: [f64; 6],
    ) -> Result<()> {
        let trade_account = &mut ctx.accounts.trade_account;
        trade_account.authority = *ctx.accounts.authority.key;
        trade_account.buying_power = buying_power;
        trade_account.portfolio = portfolio;
        Ok(())
    }
    pub fn update(ctx: Context<Update>, buying_power: f64, portfolio: [f64; 6]) -> Result<()> {
        let trade_account = &mut ctx.accounts.trade_account;
        require_keys_eq!(
            trade_account.authority,
            ctx.accounts.signer.key(),
            Error::InvalidAuthority
        );
        trade_account.buying_power = buying_power;

        trade_account.portfolio = portfolio;
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer=authority, space=MAX_SIZE)]
    pub trade_account: Account<'info, TradeAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct TradeAccount {
    pub authority: Pubkey,
    pub buying_power: f64,
    pub portfolio: [f64; 6],
}
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub trade_account: Account<'info, TradeAccount>,
    pub signer: Signer<'info>,
}
