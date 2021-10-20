// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/BEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

contract Tribe is Ownable, BEP20 {
  constructor() public BEP20("Tribe", "TRIBEX") {
    _mint(msg.sender, 50000000 * 10**18);
  }
}
