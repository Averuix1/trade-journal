# Sample CSVs

Tiny made-up exports you can drop into the **Import** page to see how the column mapping,
duplicate detection and undo work before you touch a real export.

- `topstepx-example.csv` — the TopstepX trade-export shape (`ContractName`, `EnteredAt`, `ExitedAt`,
  `EntryPrice`, `ExitPrice`, `Fees`, `PnL`, `Size`, `Type`). Contract codes such as
  `CON.F.US.ENQ.Z25` are reduced to `NQ`.
- `tradovate-example.csv` — the Tradovate trades shape (`buyPrice`, `sellPrice`,
  `boughtTimestamp`, `soldTimestamp`). There is no side column, so long vs short is worked out
  from which fill came first.

Both use New York times. Pick **America/New_York** in "Times in the file are" when you import them.
Use **Undo import** afterwards to remove them again.
