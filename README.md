# Smart Contract Project

## Overview

This repository contains a smart contract project implemented using Solidity. The project demonstrates the use of `require()`, `assert()`, and `revert()` statements to enhance contract security and functionality.

### Functionality

The smart contract (`SmartContract.sol`) implements the following functionalities:

- **require()**: Ensures conditions are met before executing transactions or functions.
- **assert()**: Validates internal conditions and halts execution if conditions are false.
- **revert()**: Reverts state changes and throws an exception if conditions are not met.

### Explanation

The project aims to showcase how these statements enhance the reliability and security of smart contracts by enforcing conditions and handling unexpected behaviors gracefully.

## Files

- `contracts/SmartContract.sol`: Contains the main smart contract code with `require()`, `assert()`, and `revert()` statements.
- `migrations/2_deploy_contracts.js`: Truffle migration script for deploying the smart contract.

## Installation

To run this project locally or in a development environment:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/SmartContract.git
   cd SmartContract
   
2. **Install dependencies (Truffle):**
npm install -g truffle
npm install

## Usage
1. **Compile the smart contracts:**
   truffle compile
2. **truffle migrate**
   migrate
3. **Test**
```bash
 let instance = await SmartContract.deployed()

// Set a valid value
await instance.setValue(10)
let value = await instance.value()
console.log(value.toString())  // Should print 10

// Reset the value
await instance.resetValue()
value = await instance.value()
console.log(value.toString())  // Should print 0

// Try setting an invalid value (should fail)
try {
    await instance.setValue(0)
} catch (error) {
    console.log(error.message)  // Should print an error message
}
```
## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For questions or feedback, please contact eidmuli@mymail.mapua.edu.ph
