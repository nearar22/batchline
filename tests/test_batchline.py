import json, sys

CONTRACT = "contracts/batchline.py"
REGULATOR = "https://recalls.gov.example/notices/coffee-mill-24"
MANUFACTURER = "https://maker.example/safety/coffee-mill-24"
MANIFEST = "https://warehouse.example/manifests/lot-k7p4"
REVIEWER = "0x2222222222222222222222222222222222222222"
REGULATOR_TEXT = "Official recall bulletin R-204 is active. Product: Northstar Coffee Mill. Affected batch range: K7P0 through K7P9. Distribution must stop immediately and affected units must be quarantined."
MANUFACTURER_TEXT = "Northstar confirms safety notice R-204 for the Northstar Coffee Mill. Units marked K7P0 through K7P9 require inspection before distribution. Contact the manufacturer for return handling."
MANIFEST_TEXT = "Warehouse dispatch manifest 88. Product: Northstar Coffee Mill. Batch code: K7P4. Quantity: 240 units. Current disposition: held at outbound gate pending recall review."


def enable_consensus(contract, monkeypatch):
    module = sys.modules[contract.__class__.__module__]
    monkeypatch.setattr(module.gl.eq_principle, "strict_eq", lambda fn: fn())
    monkeypatch.setattr(module.gl.eq_principle, "prompt_comparative", lambda fn, *_args, **_kwargs: fn())


def register(contract):
    contract.register_authority("north-zone", "recalls.gov.example")


def create(contract):
    return contract.create_case("northstar-k7p4", "Northstar Coffee Mill", "K7P4", "north-zone", REGULATOR, MANUFACTURER, MANIFEST, REVIEWER)


def web_mocks(vm):
    vm.mock_web(REGULATOR, {"method": "GET", "status": 200, "body": REGULATOR_TEXT})
    vm.mock_web(MANUFACTURER, {"method": "GET", "status": 200, "body": MANUFACTURER_TEXT})
    vm.mock_web(MANIFEST, {"method": "GET", "status": 200, "body": MANIFEST_TEXT})


def verdict(match="MATCH"):
    return {"batch_match": match, "recall_active": True, "product_match": True, "regulator_quote": "Affected batch range: K7P0 through K7P9", "manufacturer_quote": "Units marked K7P0 through K7P9 require inspection before distribution", "manifest_quote": "Batch code: K7P4", "reason": "The manifest batch is inside the active official recall range and the product identity matches."}


def mock_llm(vm, value):
    vm.mock_llm("BATCHLINE_PRODUCER", json.dumps(json.dumps(value)))


def prepare(contract, vm, monkeypatch):
    enable_consensus(contract, monkeypatch)
    register(contract)
    case_id = create(contract)
    web_mocks(vm)
    contract.freeze_evidence(case_id)
    vm.clear_mocks()
    return case_id


def test_contract_loads(direct_deploy):
    assert direct_deploy(CONTRACT) is not None


def test_authority_registry_and_source_binding(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("registry administrator"):
        contract.register_authority("north-zone", "recalls.gov.example")
    direct_vm.sender = bytes.fromhex(contract.admin[2:])
    register(contract)
    with direct_vm.expect_revert("registered authority"):
        contract.create_case("bad-authority", "Northstar Coffee Mill", "K7P4", "north-zone", "https://fake.example/notice", MANUFACTURER, MANIFEST, REVIEWER)


def test_rejects_duplicates_same_reviewer_and_duplicate_sources(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT); register(contract); create(contract)
    with direct_vm.expect_revert("already exists"):
        create(contract)
    with direct_vm.expect_revert("distinct"):
        contract.create_case("same-source", "Northstar Coffee Mill", "K7P4", "north-zone", REGULATOR, REGULATOR, MANIFEST, REVIEWER)
    with direct_vm.expect_revert("distinct valid address"):
        contract.create_case("same-reviewer", "Northstar Coffee Mill", "K7P4", "north-zone", REGULATOR, MANUFACTURER, MANIFEST, str(direct_vm.sender))


def test_freeze_preserves_all_source_bodies_and_digests(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); enable_consensus(contract, monkeypatch); register(contract); case_id = create(contract); web_mocks(direct_vm)
    frozen = contract.freeze_evidence(case_id)
    record = contract.get_case(case_id); snapshot = record["snapshots"][0]
    assert frozen["status"] == "FROZEN" and snapshot["complete"] is True
    assert [row["role"] for row in snapshot["documents"]] == ["regulator", "manufacturer", "manifest"]
    assert [row["content"] for row in snapshot["documents"]] == [REGULATOR_TEXT, MANUFACTURER_TEXT, MANIFEST_TEXT]
    assert all(len(row["sha256"]) == 64 for row in snapshot["documents"])


def test_forged_quote_is_rejected(direct_vm, direct_deploy, monkeypatch):
    contract = direct_deploy(CONTRACT); case_id = prepare(contract, direct_vm, monkeypatch)
    forged = verdict(); forged["regulator_quote"] = "This batch is safe to ship"
    mock_llm(direct_vm, forged)
    with direct_vm.expect_revert("regulator_quote is not bound"):
        contract.inspect_batch(case_id)


def test_recall_match_closes_gate_and_only_owner_confirms(direct_vm, direct_deploy, direct_alice, monkeypatch):
    contract = direct_deploy(CONTRACT); case_id = prepare(contract, direct_vm, monkeypatch); mock_llm(direct_vm, verdict())
    result = contract.inspect_batch(case_id)
    assert result["decision"] == "QUARANTINE" and contract.get_gate(case_id)["shipment_gate"] == "BLOCKED"
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("case owner"):
        contract.confirm_quarantine(case_id)
    direct_vm.sender = bytes.fromhex(contract.admin[2:])
    confirmed = contract.confirm_quarantine(case_id)
    assert confirmed["status"] == "QUARANTINE_CONFIRMED" and confirmed["shipment_gate"] == "BLOCKED"


def test_clear_result_requires_independent_release(direct_vm, direct_deploy, direct_alice, monkeypatch):
    contract = direct_deploy(CONTRACT); case_id = prepare(contract, direct_vm, monkeypatch); clear = verdict("NO_MATCH"); clear["reason"] = "The exact manifest batch is outside the active range stated by the authority evidence."
    mock_llm(direct_vm, clear); result = contract.inspect_batch(case_id)
    assert result["decision"] == "CLEAR" and contract.get_gate(case_id)["shipment_gate"] == "BLOCKED"
    with direct_vm.expect_revert("appointed safety reviewer"):
        contract.authorize_release(case_id)
    direct_vm.sender = REVIEWER
    released = contract.authorize_release(case_id)
    assert released["status"] == "RELEASED" and released["shipment_gate"] == "OPEN"
    direct_vm.sender = REVIEWER
    with direct_vm.expect_revert("Shipment release remains blocked"):
        contract.authorize_release(case_id)
