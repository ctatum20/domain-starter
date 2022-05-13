import React, { useEffect, useState } from 'react';
import './styles/App.css';
import twitterLogo from './assets/twitter-logo.svg';
import { ethers } from 'ethers';
import Domains from './utils/Domains.json'
import polygonLogo from './assets/polygonlogo.png';
import ethLogo from './assets/ethlogo.png';
import {networks} from './utils/networks';


// Constants
const TWITTER_HANDLE = 'moccaOnTheBlock';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
// add domain to be minted
const tld = '.tatum';
const CONTRACT_ADDRESS = '0x77e2837EfE19950eB5F6425512D88Dc8CC42c465';

const App = () => {
	// a state variable to store our user's public wallet
	const [currentAccount, setCurrentAccount] = useState('');
	const [domain, setDomain] = useState('');
	const [record, setRecord] = useState('');
	const [network, setNetwork] = useState('');
	const [editing, setEditing] = useState(false);
	const [loading, setLoading] = useState(false);
	const [mints, setMints] = useState([]);
	
	// implement your connectWallet method here
	const connectWallet = async () => {
		try {
			const { ethereum } = window;

			if (!ethereum) {
				alert('Get MetaMask -> https://metamask.io/');
				return;
			}

			// method to request access to account
			const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

			// this will print out public address once we authorize MetaMask
			console.log('Connected', accounts[0]);
			setCurrentAccount(accounts[0]);
		} catch (error) {
			console.log(error)
		}
	}

	const switchNetwork = async () => {
		if (window.ethereum) {
			try {
				await window.ethereum.request({ // tries to switch to Mumbai testnet
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: '0x13881' }], // check network,js for hexadecimal network ids
				});
			} catch(error) {
				if (error.code === 4902) { // means the chain we want has not been added to MM so ask user to add it to theirs
					try {
						await window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{
									chainId:'0x13881',
									chainName: 'Polygon Mumbai Testnet',
									rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
									nativeCurrency: {
										name: "Mumbai Matic",
										symbol: "MATIC",
										deciamls: 18
									},
									blockExplorerUrls: ["https://mumbai.polyscan.com/"]
								},
							],
						});
					} catch (error) {
						console.log(error);
					}
				}
				console.log(error);
			}
		} else {
			alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
		}
	}

	const checkIfWalletIsConnected = async () => {
		// make sure we have access to window.ethereum
		const { ethereum } = window;

		if (!ethereum) {
			console.log("Make sure you have MetaMask!");
			return;
		} else {
			console.log("We have the ethereum object", ethereum);
		}

		// check if we're authorized to access the user's wallet
		const accounts = await ethereum.request({ method: 'eth_accounts' });

		// users can have multiple authorized accounts, we grab the first one if its there
		if(accounts.length !==0) {
			const account = accounts[0];
			console.log('Found an authorized account:', account);
			setCurrentAccount(account);
		} else {
			console.log('No authorized account found');
		}

		const chainId = await ethereum.request({ method: 'eth_chainId' });
		setNetwork(networks[chainId]);

		ethereum.on('chainChanged', handleChainChanged);

		// reload page when user change networks
		function handleChainChanged(_chainId) {
			window.location.reload();
		}
	};

	const mintDomain = async() => {
		// dont run if domain is empty
		if(!domain) {return}
		// alert user if domain is too short
		if(domain.length < 3) {
			alert('Domain must be at least 3 characters long');
			return;
		}
		// calculate price based on length of domain(change to match your contract)
		//3 chars = 0.5 MARIC, 4 chars= 0.3 MATIC, 5 or more = 0.1 MATIC
		const price = domain.length === 3 ? '0.5' : domain.length === 4 ? '0.3' : '0.1';
		console.log("Minting domain", domain, "with price", price);
		try {
			const {ethereum} = window;
			if(ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, Domains.abi, signer);
					console.log("Going to pop wallet now to pay gas...")

				let tx = await contract.register(domain, {value: ethers.utils.parseEther(price)});
				
				// wait for the transaction to be mined
				const receipt = await tx.wait();
				
				// check if transaction is complete
				if(receipt.status === 1) {
					console.log("Domain minted! https://mumbai.polygonscan.com/tx/"+tx.hash);

					//set the record for the domain
					tx = await contract.setRecord(domain, record);
					await tx.wait();

					console.log("Record set! https://mumbai.polygonscan.com/tx"+tx.hash);

					// call fetchMints after 2 seconds
					setTimeout(() => {
						fetchMints();
					}, 2000);

					setRecord('');
					setDomain('');
				} else {
					alert("Transaction failed! Please try again");
				}
			}
		}
		catch(error) {
			console.log(error);
		}
	}

	const fetchMints = async () => {
		try {
			const {ethereum} = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, Domains.abi, signer);

				const names = await contract.getAllNames();

				// for each new name, get record and address
				const mintRecords = await Promise.all(names.map(async (name) => {
					const mintRecord = await contract.records(name);
					const owner = await contract.domains(name);
					return {
						id: names.indexOf(name),
						name: name,
						record: mintRecord,
						owner: owner,
					};
				}));

				console.log("MINTS FETCHED ", mintRecords);
				setMints(mintRecords);
			}
		} catch(error) {
			console.log(error);
		}
	}

	useEffect(()=> {
		if (network === 'Polygon Mumbai Testnet') {
			fetchMints();
		}
	}, [currentAccount, network])

	const updateDomain = async () => {
		if (!record || !domain) {return}
		setLoading(true);
		console.log("Updating domain", domain, 'with record', record);
			try {
				const {ethereum} = window;
				if (ethereum) {
					const provider = new ethers.providers.Web3Provider(ethereum);
					const signer = provider.getSigner();
					const contract = new ethers.Contract(CONTRACT_ADDRESS, Domains.abi, signer);

					let tx = await contract.setRecord(domain, record);
					await tx.wait();
					console.log("Record set https://mumbai.polyscan.com/tx/"+tx.hash);

					fetchMints();
					setRecord('');
					setDomain('');
				}
			} catch(error) {
				console.log(error);
			}
			setLoading(false);
	}
	// Render Methods
	// this is a function to render if wallet is not connected yet
	const renderNotConnectedContainer = () => (
		<div className='connect-wallet-container'>
			<img src="https://media.giphy.com/media/3kIGlrAV5DyJBx7RJQ/giphy.gif" alt="woman saying oh this is nice" />			
			<button onClick={connectWallet} className='cta-button connect-wallet-button'>
				Connect Wallet
			</button>
		</div>
	);

	// form to enter domain name and data
	const renderInputForm = () => {
		if (network !== 'Polygon Mumbai Testnet') {
			return (
				<div className='connect-wallet-container'>
					<h2>Please switch to Polygon Mumbai Testnet</h2>
					<button classname='cta-button mint-button' onClick={switchNetwork}>Click here to switch</button>
				</div>
			);
		}

		return (
			<div className='form-container'>
				<div className='first-row'>
					<input 
						type="text"
						value={domain}
						placeholder='domain'
						onChange={e => setDomain(e.target.value)}
					/>
					<p className='tld'>{tld}</p>
				</div>

					<input 
						type="text" 
						value={record}
						placeholder="what's your name"
						onChange={e => setRecord(e.target.value)}
					/>
					{/* if the editing variable is true, return the "set record" and "Cancel" button*/}
					{editing ? (
						<div className='button-container'>
							<button className='cta-button mint-button' disabled={loading} onClick={updateDomain}>
							 Set record
							</button>
							{/* let us get out of editing mode by setting editing false */}
							<button className='cta-button mint-button' onClick={() => {setEditing(false)}}> 
							 Cancel
							</button> 
						</div>
					) : (
						<button className='cta-button mint-button' disabled={loading} onClick={mintDomain}> 
						{/* if editing is not true, the mint button will be returned instead */}
							Mint
						</button>
						
					)}
			</div>
		);
	}

	const renderMints = () => {
		if (currentAccount && mints.length > 0) {
			return (
				<div className='mint-container'>
					<p className='subtitle'>Recently minted domains!</p>
					<div className='mint-list'>
						{mints.map((mint, index) => {
							return (
								<div className='mint-item' key={index}>
									<div className='mint-row'>
										<a className='link' href={`https://testnets.opensea.io/assets/mumbai/${CONTRACT_ADDRESS}/${mint.id}`} target="_blank" rel="noopener noreferrer">
											<p className='underlined'>{' '}{mint.name}{tld}{' '}</p>
										</a>
										{/* if mint.owner is currentAccount, add an 'edit' button */}
										{mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
										<button className='edit-button' onClick={() => editRecord(mint.name)}>
											<img className='edit-icon' src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" />
										</button>
										:
										null
									}
									</div>
									<p> {mint.record} </p>
								</div>
							)
						})}
					</div>
				</div>
			)
		}
	};

	const editRecord = (name) => {
		console.log("Editing record for", name);
		setEditing(true);
		setDomain(name);
	}


	{!currentAccount && renderNotConnectedContainer()}
	{currentAccount && renderInputForm()}
	{mints && renderMints()}

	// runs the function when the page loads
	useEffect(() => {
		checkIfWalletIsConnected();
	}, [])

  return (
		<div className="App">
			<div className="container">
				<div className="header-container">
					<header>
						<div className="left">
						<p className="title">Tatum Name Service ☀️</p>
						<p className="subtitle">Your wonderfully authored API on the blockchain!</p>
					</div>
					<div className='right'>
						<img alt="Network logo" className='logo' src={network.includes("Polygon") ? polygonLogo : ethLogo }/>
						{ currentAccount ? <p>Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}</p> : <p> Not Connected</p> }
					</div>
				</header>
			</div>

		<div class="bg"></div>
		<div class="bg bg2"></div>
		<div class="bg bg3"></div>
		{/* <div id="frosted-glass-mask" >
  		<h1>charnice.tatum</h1></div> */}
		  	  {/*Hide connect button if currentAccount isn't empty*/}
		{!currentAccount && renderNotConnectedContainer()}
		{/* Render input form if an account is connected */}
		{currentAccount && renderInputForm()}
        <div className="footer-container">
					<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
					<a
						className="footer-text"
						href={TWITTER_LINK}
						target="_blank"
						rel="noreferrer"
					>{`built by @${TWITTER_HANDLE}`}</a>
				</div>
			</div>
		</div>
	);
}

export default App;


