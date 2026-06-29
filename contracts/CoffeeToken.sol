// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * CoffeeToken — ERC-20 RWA token for tokenised coffee lots.
 *
 * Deploy one instance per grade:
 *   CR1  (Grade 1 Robusta)
 *   CR2  (Grade 2 Robusta)
 *   CR3  (Grade 3 Robusta)
 *
 * 1 token = 1 kg of the corresponding grade.
 * Token amount is stored with 18 decimals (standard ERC-20).
 *
 * Grade determination and all SCAA / ICE EU quality criteria live in
 * the backend GradeService — NOT in this contract.  The contract only
 * records Lot ID, quantity, and the owner.
 */
contract CoffeeToken is ERC20, AccessControl, Pausable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // On-chain lot ledger — lotCode → record
    struct LotRecord {
        address farmer;
        uint256 amount;     // wei-scaled
        uint256 mintedAt;
        bool    redeemed;
    }
    mapping(string => LotRecord) public lots;
    mapping(string => bool)      public lotMinted;

    // ── Events ───────────────────────────────────────────────────────────
    event TokenMinted(
        address indexed to,
        uint256         amount,
        string          lotCode,
        string          requestId
    );

    event TokenBurned(
        address indexed from,
        uint256         amount,
        string          lotCode,
        string          redeemId
    );

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(
        string memory name,
        string memory symbol,
        address       admin
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE,        admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ── Mint ─────────────────────────────────────────────────────────────
    /**
     * @param to        Farmer wallet address.
     * @param amount    Token amount (scaled by 10**18, i.e. 1 kg = 1e18).
     * @param lotCode   Unique lot identifier (e.g. "LOT-2026-001-A").
     * @param requestId Backend token_request.id (as string) for traceability.
     */
    function mint(
        address         to,
        uint256         amount,
        string calldata lotCode,
        string calldata requestId
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        require(to != address(0),            "CoffeeToken: mint to zero address");
        require(amount > 0,                  "CoffeeToken: amount must be > 0");
        require(bytes(lotCode).length > 0,   "CoffeeToken: lotCode is required");
        require(!lotMinted[lotCode],         "CoffeeToken: lot already minted");

        _mint(to, amount);

        lots[lotCode] = LotRecord({
            farmer:    to,
            amount:    amount,
            mintedAt:  block.timestamp,
            redeemed:  false
        });
        lotMinted[lotCode] = true;

        emit TokenMinted(to, amount, lotCode, requestId);
    }

    // ── Burn ─────────────────────────────────────────────────────────────
    /**
     * Called by backend on admin-approved redeem.
     * Backend wallet holds MINTER_ROLE and can burn from any address
     * (platform custody model — users' tokens are held by platform wallet).
     *
     * @param from      Token holder address.
     * @param amount    Amount to burn (18-decimal scaled).
     * @param lotCode   Lot reference for event tracing ("" if partial redeem).
     * @param redeemId  Backend redeem_request.id as string.
     */
    function burn(
        address         from,
        uint256         amount,
        string calldata lotCode,
        string calldata redeemId
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        require(from != address(0), "CoffeeToken: burn from zero address");
        require(amount > 0,         "CoffeeToken: amount must be > 0");
        _burn(from, amount);
        emit TokenBurned(from, amount, lotCode, redeemId);
    }

    // ── Pause ─────────────────────────────────────────────────────────────
    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // Block transfers while paused
    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }

    // ── Interface support ─────────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
