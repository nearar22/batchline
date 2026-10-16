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

Deployment and verified transaction references are added only after source matching and a live end-to-end gate test pass.
