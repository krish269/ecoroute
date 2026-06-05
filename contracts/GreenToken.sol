// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title GreenToken — Municipal recycling reward token for EcoRoute
contract GreenToken is ERC20, Ownable {
    address public minter;
    uint256 public totalMintedTokens;

    mapping(string => bool) public redemptionCategories;

    event TokensMinted(address indexed recipient, uint256 amount, string submissionId);
    event TokensRedeemed(address indexed redeemer, uint256 amount, string category);
    event MinterTransferred(address indexed oldMinter, address indexed newMinter);
    event RedemptionCategoryRegistered(string category);

    modifier onlyMinter() {
        require(msg.sender == minter, "GreenToken: caller is not the minter");
        _;
    }

    constructor(address _minter) ERC20("GreenToken", "GRN") Ownable(msg.sender) {
        require(_minter != address(0), "GreenToken: minter is zero address");
        minter = _minter;
        redemptionCategories["transit"] = true;
        redemptionCategories["discount"] = true;
        redemptionCategories["municipal"] = true;
    }

    /// @notice Mint GRN tokens to a resident wallet (minter only)
    function mint(address recipient, uint256 amount, string calldata submissionId) external onlyMinter {
        require(recipient != address(0), "GreenToken: recipient is zero address");
        require(amount > 0, "GreenToken: amount must be greater than zero");
        _mint(recipient, amount);
        totalMintedTokens += amount;
        emit TokensMinted(recipient, amount, submissionId);
    }

    /// @notice Returns cumulative minted token count
    function totalMinted() external view returns (uint256) {
        return totalMintedTokens;
    }

    /// @notice Burn tokens in exchange for a redemption record
    function redeem(uint256 amount, string calldata category) external {
        require(amount >= 1, "GreenToken: quantity must be at least 1");
        require(redemptionCategories[category], "GreenToken: unrecognized redemption category");
        require(balanceOf(msg.sender) >= amount, "GreenToken: insufficient balance");
        _burn(msg.sender, amount);
        emit TokensRedeemed(msg.sender, amount, category);
    }

    /// @notice Transfer minting rights (owner only)
    function transferMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "GreenToken: new minter is zero address");
        emit MinterTransferred(minter, newMinter);
        minter = newMinter;
    }

    /// @notice Register a new redemption category (owner only)
    function registerRedemptionCategory(string calldata category) external onlyOwner {
        require(bytes(category).length > 0, "GreenToken: empty category");
        redemptionCategories[category] = true;
        emit RedemptionCategoryRegistered(category);
    }
}
