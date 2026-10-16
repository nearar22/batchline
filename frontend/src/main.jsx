import React, { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createTransactionKit } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import { actionsFor, clean, gateTone, short } from "./model.mjs";
import "./styles.css";

const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const RPC = import.meta.env.VITE_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID || "61997");
const CHAIN = { ...studioDevnet, id: CHAIN_ID, name: "GenLayer Studio Next", rpcUrls: { default: { http: [RPC] } } };
const EXPLORER = "https://explorer-studio-dev.genlayer.com";
const DEMO = { id: "northstar-k7p4", product_name: "Northstar Coffee Mill", batch_code: "K7P4", jurisdiction: "north-zone", authority_host: "recalls.gov.example", owner: "0x1111111111111111111111111111111111111111", reviewer: "0x2222222222222222222222222222222222222222", revision: 0, status: "QUARANTINED", shipment_gate: "BLOCKED", evidence: [{ role: "regulator", host: "recalls.gov.example", url: "https://recalls.gov.example/notices/coffee-mill-24" }, { role: "manufacturer", host: "maker.example", url: "https://maker.example/safety/coffee-mill-24" }, { role: "manifest", host: "warehouse.example", url: "https://warehouse.example/manifests/lot-k7p4" }], assessment: { decision: "QUARANTINE", batch_match: "MATCH", recall_active: true, product_match: true, reason: "The exact lot falls inside the active official recall range.", snapshot_digest: "94f1c4a29ba1d426223426bb173f879d06f78dd41172d3d086a323182dc9df20", receipts: [{ role: "regulator", sha256: "1a8ed2c5b906594cc1b7d956f7900a7d161e9dd3fc74b43e01f5daf689a2bc01" }, { role: "manufacturer", sha256: "e0f736e521689832149fbfb9208d248f3624646092841e436f01368b88e557d4" }, { role: "manifest", sha256: "f85a38f65e132a49f7e22ef7522357bc733122cc703d32dc7261c860558b02ad" }] } };

function App() {
  const [caseId, setCaseId] = useState("northstar-k7p4");
  const [product, setProduct] = useState("Northstar Coffee Mill");
  const [batch, setBatch] = useState("K7P4");
  const [jurisdiction, setJurisdiction] = useState("north-zone");
  const [authorityHost, setAuthorityHost] = useState("recalls.gov.example");
  const [urls, setUrls] = useState(["https://recalls.gov.example/notices/coffee-mill-24", "https://maker.example/safety/coffee-mill-24", "https://warehouse.example/manifests/lot-k7p4"]);
  const [reviewer, setReviewer] = useState("0x2222222222222222222222222222222222222222");
  const [record, setRecord] = useState(DEMO);
  const [wallet, setWallet] = useState("");
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState("");
  const client = useMemo(() => createClient({ chain: CHAIN }), []);
  const kit = useMemo(() => wallet && window.ethereum ? createTransactionKit({ chain: CHAIN, provider: window.ethereum, account: wallet }) : null, [wallet]);

  const connect = async () => {
    if (!window.ethereum) return setNotice("A browser wallet is required for writes. Public gate records remain readable.");
    try {
      const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = `0x${CHAIN_ID.toString(16)}`;
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] }); }
      catch (error) { if (error?.code !== 4902) throw error; await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId, chainName: CHAIN.name, rpcUrls: [RPC], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 } }] }); }
      setWallet(account); setNotice("");
    } catch (error) { setNotice(error?.message || "Wallet connection did not complete."); }
  };
  const load = useCallback(async () => {
    if (!ADDRESS || !caseId.trim()) return;
    try { setRecord(clean(await client.readContract({ address: ADDRESS, functionName: "get_case", args: [caseId.trim()], jsonSafeReturn: true }))); setNotice(""); }
    catch { setNotice("No live inspection case was found for that ID."); }
  }, [caseId, client]);
  const tx = useMemo(() => {
    if (!ADDRESS || !action) return null;
    const base = { kind: "write", address: ADDRESS };
    if (action === "authority") return { ...base, method: "register_authority", args: [jurisdiction.trim(), authorityHost.trim()] };
    if (action === "create") return { ...base, method: "create_case", args: [caseId.trim(), product.trim(), batch.trim(), jurisdiction.trim(), ...urls.map(item => item.trim()), reviewer.trim()] };
    if (action === "freeze") return { ...base, method: "freeze_evidence", args: [caseId.trim()] };
    if (action === "inspect") return { ...base, method: "inspect_batch", args: [caseId.trim()] };
    if (action === "quarantine") return { ...base, method: "confirm_quarantine", args: [caseId.trim()] };
    return { ...base, method: "authorize_release", args: [caseId.trim()] };
  }, [action, authorityHost, batch, caseId, jurisdiction, product, reviewer, urls]);
  const write = next => { if (!ADDRESS) return setNotice("Deploy the contract and configure its address before writing."); if (!kit) return setNotice("Connect a Studio Next wallet first."); setAction(next); };
  const done = status => { if (status.phase === "finalized") { setAction(null); if (status.successful) void load(); else setNotice(`Transaction failed: ${status.executionResultName || status.statusName || "rejected"}.`); } };
  const actions = actionsFor(record, wallet);
  const updateUrl = (index, value) => setUrls(current => current.map((item, i) => i === index ? value : item));

  return <div className="shell">
    <header><div className="brand"><span>BL</span><b>BATCHLINE</b></div><div className="chain"><i/> STUDIO NEXT / {CHAIN_ID}</div><button onClick={connect}>{wallet ? short(wallet) : "CONNECT WALLET"}</button></header>
    <main>
      <section className="marquee"><div><small>RECALL CONTROL / BAY 04</small><h1>Nothing crosses<br/>an uncertain line.</h1></div><div className={`gate ${gateTone(record.shipment_gate)}`}><small>SHIPMENT GATE</small><strong>{record.shipment_gate}</strong><span>{record.status}</span></div></section>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <section className="control-grid">
        <div className="scanner">
          <div className="scan-head"><span>01 / IDENTIFY LOT</span><em>LIVE INPUT</em></div>
          <label>CASE ID<input value={caseId} onChange={e => setCaseId(e.target.value)}/></label>
          <div className="batch-input"><label>PRODUCT<input value={product} onChange={e => setProduct(e.target.value)}/></label><label>BATCH / LOT<input className="code" value={batch} onChange={e => setBatch(e.target.value)}/></label></div>
          <div className="authority-strip"><label>JURISDICTION<input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}/></label><label>OFFICIAL AUTHORITY HOST<input value={authorityHost} onChange={e => setAuthorityHost(e.target.value)}/></label><button onClick={() => write("authority")}>REGISTER</button></div>
          <div className="source-feed">{["REGULATOR BULLETIN", "MAKER NOTICE", "LOT MANIFEST"].map((name, index) => <label key={name}><span>{String(index + 1).padStart(2,"0")}</span><b>{name}</b><input value={urls[index]} onChange={e => updateUrl(index, e.target.value)}/></label>)}</div>
          <label>INDEPENDENT SAFETY REVIEWER<input value={reviewer} onChange={e => setReviewer(e.target.value)}/></label>
          <button className="open-case" onClick={() => write("create")}>OPEN INSPECTION CASE →</button>
        </div>

        <div className="line-floor">
          <div className="load"><input value={caseId} onChange={e => setCaseId(e.target.value)}/><button onClick={load}>LOAD CASE</button></div>
          <div className="belt-label"><span>02 / EVIDENCE LINE</span><code>{record.id}</code></div>
          <div className="belt"><div className="rail"/>{record.evidence.map((item, index) => <a className="crate" href={item.url} target="_blank" key={item.role}><small>{item.role}</small><b>{item.host}</b><span>{record.assessment?.receipts?.[index]?.sha256 ? `${record.assessment.receipts[index].sha256.slice(0,8)}…${record.assessment.receipts[index].sha256.slice(-6)}` : "NOT FROZEN"}</span></a>)}<div className="scan-aperture"><i/><b>CONSENSUS<br/>SCAN</b></div></div>
          <div className="verdict"><div><small>PRODUCT</small><b>{record.product_name}</b></div><div><small>BATCH</small><b className="mono">{record.batch_code}</b></div><div><small>DECISION</small><b>{record.assessment?.decision || "PENDING"}</b></div></div>
          <div className="rationale"><span>{record.assessment?.batch_match || "—"}</span><p>{record.assessment?.reason || "Freeze all three sources, then let validators inspect recall scope and lot identity."}</p></div>
          {record.assessment?.snapshot_digest && <div className="digest"><span>IMMUTABLE EVIDENCE PACKET</span><code>{record.assessment.snapshot_digest}</code></div>}
          <div className="actions">
            {actions.includes("freeze") && <button onClick={() => write("freeze")}>FREEZE EVIDENCE</button>}
            {actions.includes("inspect") && <button onClick={() => write("inspect")}>RUN RECALL SCAN</button>}
            {actions.includes("quarantine") && <button className="danger" onClick={() => write("quarantine")}>CONFIRM QUARANTINE</button>}
            {actions.includes("release") && <button className="safe" onClick={() => write("release")}>REVIEWER: OPEN GATE</button>}
          </div>
        </div>
      </section>
      <section className="rule"><b>FAIL-CLOSED BY DESIGN</b><p>Manufacturer and warehouse records can identify a product and lot. Only the registered regulator host can establish recall authority. Any uncertainty leaves the shipment gate blocked.</p></section>
    </main>
    <footer><span>BATCHLINE / RECALL SCOPE BEFORE RELEASE</span>{ADDRESS ? <a href={`${EXPLORER}/address/${ADDRESS}`} target="_blank">CONTRACT {short(ADDRESS)} ↗</a> : <b>CONTRACT NOT DEPLOYED</b>}</footer>
    {action && kit && tx && <div className="modal"><div><div className="modal-head"><b>GENLAYER TRANSACTION</b><button onClick={() => setAction(null)}>×</button></div><GenLayerTransactionPanel kit={kit} tx={tx} network={CHAIN.name} theme="light" trackUntil="finalized" onDone={done}/></div></div>}
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
