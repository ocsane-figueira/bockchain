/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const express = require('express');

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, enrollAdmin, registerAndEnrollUser } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');

//aqui ẽ feita a inicializacao da config da API
const app = express();
const port = 3000;

const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'javascriptAppUser3';

app.use(express.static('public'));
app.use(express.json());

//comunicacao da servidor com a blockchain
async function getGateway() {
	const ccp = buildCCPOrg1();
	const wallet = await buildWallet(Wallets, walletPath);
	const gateway = new Gateway();
	await gateway.connect(ccp, {
		wallet,
		identity: org1UserId,
		discovery: { enabled: true, asLocalhost: true }
	});
	return gateway;
}

async function readAllAssets() {
	try {
		const gateway = await getGateway();
		const network = await gateway.getNetwork(channelName);
		const contract = network.getContract(chaincodeName);

		const result = await contract.evaluateTransaction('ReadAll');
		return JSON.parse(result.toString());
	} catch (error) {
		console.error(`Failed to evaluate transaction: ${error}`);
		throw error;
	}
}

async function readAllCustodyRecords() {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        const result = await contract.evaluateTransaction('ReadCustodyRecords');
        return JSON.parse(result.toString());
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        throw error;
    }
}

async function readAsset(id) {
	const itemId = id;

	try {
		const gateway = await getGateway();
		const network = await gateway.getNetwork(channelName);
		const contract = network.getContract(chaincodeName);

		const result = await contract.evaluateTransaction('ReadIndividual', itemId);
		return JSON.parse(result.toString());
	} catch (error) {
		console.error(`Failed to evaluate transaction: ${error}`);
		throw error;
	}
}

async function addAsset(item) {
	const { itemId, description, quantity, custodian, value } = item;

	try {
		const gateway = await getGateway();
		const network = await gateway.getNetwork(channelName);
		const contract = network.getContract(chaincodeName);

		const result = await contract.submitTransaction('AddItem', itemId, description, quantity, custodian, value);
		return JSON.parse(result.toString());
	} catch (error) {
		console.error(`Failed to evaluate transaction: ${error}`);
		throw error;
	}
}

async function transferAssetCustody(item) {
    const { itemId, novocustodian } = item;

    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        const result = await contract.submitTransaction('TransferCustody', itemId, novocustodian);
        return JSON.parse(result.toString());
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        throw error;
    }
}

// Endpoint para listar todos os assets
app.get('/api/assets', async (req, res) => {
	try {
		const result = await readAllAssets();
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: error.toString() });
	}
});

// Endpoint para listar todos os registros de custódia
app.get('/api/custodia', async (req, res) => {
    try {
        const result = await readAllCustodyRecords();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Endpoint para obter um asset específico
app.get('/api/asset/:id', async (req, res) => {
	const itemId = req.params.id;

	try {
		const result = await readAsset(itemId);
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: error.toString() });
	}
});

// Endpoint para adicionar um novo asset
app.post('/api/asset/transfer', async (req, res) => {
	const { itemId, description, quantity, custodian, value } = req.body;

	try {
		const result = await addAsset({ itemId, description, quantity, custodian, value });
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: error.toString() });
	}
});

// Endpoint para transferir a custódia de um asset
app.post('/api/asset/transfer-custodia', async (req, res) => {
    const { itemId, novocustodian } = req.body;

    try {
        const result = await transferAssetCustody({ itemId, novocustodian });
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});

/**
 *  A test application to show basic queries operations with any of the asset-transfer-basic chaincodes
 *   -- How to submit a transaction
 *   -- How to query and check the results
 *
 * To see the SDK workings, try setting the logging to show on the console before running
 *        export HFC_LOGGING='{"debug":"console"}'
 */
async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg1);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

		// Create a new gateway instance for interacting with the fabric network.
		// In a real application this would be done as the backend server session is setup for
		// a user that has been verified.
		const gateway = new Gateway();

		try {
			// setup the gateway instance
			// The user will now be able to create connections to the fabric network and be able to
			// submit transactions and query. All transactions submitted by this gateway will be
			// signed by this user using the credentials stored in the wallet.
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			// Build a network instance based on the channel where the smart contract is deployed
			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// Initialize a set of asset data on the channel using the chaincode 'InitLedger' function.
			// This type of transaction would only be run once by an application the first time it was started after it
			// deployed the first time. Any updates to the chaincode deployed later would likely not need to run
			// an "init" type function.
			console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			await contract.submitTransaction('InitLedger');
			console.log('* Result: committed');
		} finally { }
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
		process.exit(1);
	}
}


main();

