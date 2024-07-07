// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract SmartContract {
    uint public value;

    function setValue(uint _value) public {
        require(_value > 0, "Value must be greater than zero");
        value = _value;
        assert(value == _value);
    }

    function resetValue() public {
        value = 0;
        if (value != 0) {
            revert("Value reset failed");
        }
    }
}
