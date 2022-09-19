use anchor_lang::prelude::*;

declare_id!("EkSeBQi7LrfwoiyGbqBxPMReRN5u9wZuxQ2f72HDaEhP");

/**
 * Index references
 * 0/ BTC-PERP  [amount (USD), average]
 * 1/ ETH-PERP
 * 2/ SOL-PERP
 */
const MAX_SIZE: usize = 8 + 8 + 1 + (8 + 8) * (3);
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

        trade_account.buying_power = buying_power;
        trade_account.portfolio = portfolio;
        trade_account.bump = *ctx.bumps.get("trade_account").unwrap();
        Ok(())
    }
    pub fn update(ctx: Context<Update>, buying_power: f64, portfolio: [f64; 6]) -> Result<()> {
        let trade_account = &mut ctx.accounts.trade_account;

        trade_account.buying_power = buying_power;
        trade_account.portfolio = portfolio;
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer=authority, space=MAX_SIZE, seeds=[b"trade", authority.key().as_ref()], bump)]
    pub trade_account: Account<'info, TradeAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct TradeAccount {
    pub buying_power: f64,
    pub portfolio: [f64; 6],
    pub bump: u8,
}
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, seeds=[b"trade",authority.key().as_ref()],bump=trade_account.bump)]
    pub trade_account: Account<'info, TradeAccount>,
    pub authority: Signer<'info>,
}
