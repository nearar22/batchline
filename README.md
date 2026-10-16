# BATCHLINE / outbound recall control

Batchline sits at the last warehouse gate. Give it a product lot, one registered regulator bulletin, a manufacturer notice, and the outbound manifest. GenLayer validators freeze the complete packet and decide whether that exact lot falls inside an active recall. Until an independent safety reviewer approves a clear result, the shipment gate stays closed.

## Operating sequence

`REGISTER AUTHORITY → OPEN CASE → FREEZE PACKET → INSPECT LOT → QUARANTINE or REVIEWER RELEASE`

The regulator source is authority-bound by hostname. Manufacturer and manifest sources may prove identity, but cannot overrule recall scope. Every source body, URL, role, digest, and content length remains attached to the decision. Missing, conflicting, or uncertain evidence fails closed.

## What changes on-chain

- `QUARANTINE`: active recall + matching product + matching lot. Gate stays `BLOCKED`.
- `REVIEW`: uncertainty or incomplete scope. Gate stays `BLOCKED`.
- `CLEAR`: lot is outside the authoritative recall scope, but the gate still stays `BLOCKED`.
- `RELEASED`: only the appointed reviewer can move a clear case to gate `OPEN`.

No fund movement is implied. Batchline is an operational evidence gate, not a regulator, product-safety guarantee, or substitute for a legally required recall process.

## Run the checks

```bash
python -m pytest tests -q
genvm-lint lint contracts/batchline.py --json
cd frontend
npm install
npm test
npm run build
```

The files under `docs/demo-*.txt` are explicitly operator-created fixtures. They demonstrate the workflow; they are not independent authorities.

## Studio Next

Network: GenLayer Studio Next · chain `61997` · RPC `https://studio-next.genlayer.com/api`

### Verified deployment

- Contract: [`0xCdE6...51Af`](https://explorer-studio-dev.genlayer.com/address/0xCdE6a0cf6FE1DD8C051D9944a8A1653d9F3a51Af)
- Deployment: [`0x2fed...8849`](https://explorer-studio-dev.genlayer.com/tx/0x2fed5520636775d311f2e26df3f637f721015caa5fbc149fc9902bc72b748849)
- Complete packet freeze: [`0xa46d...427d`](https://explorer-studio-dev.genlayer.com/tx/0xa46d9de24029b84a11cac34e18db2ef82a223c94d03a53ad7ef61374fced427d)
- Validator inspection: [`0xc2cf...9b2e`](https://explorer-studio-dev.genlayer.com/tx/0xc2cfe3cc5df59cb26404ba5ec4087a356358435c1b10ea6f2155282835fa9b2e)
- Quarantine confirmation: [`0x536a...d0bd`](https://explorer-studio-dev.genlayer.com/tx/0x536a4390f012ff734839451db90601ee2b8d5bf3f7c2af344cc561e67dbbd0bd)
- Live result: `QUARANTINE_CONFIRMED`, shipment gate `BLOCKED`
- Deployed and local source SHA-256: `39ba5debce0e6b17e3b7828dce65f1d90c88829e62bb29ca86bbec7839f73936`
