import { Image, StyleSheet, View, useColorScheme } from "react-native";
import { ParallaxScrollView } from "@/components/ParallaxScrollView";
import { ThemedButton } from "@/components/ThemedButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { QRCodeGenerator } from "@/components/QRCodeGenerator"; // Import your QR component
import { chain, client } from "@/constants/thirdweb";
import { useEffect, useState, useMemo } from "react";
import { createAuth } from "thirdweb/auth";
import { avalanche, avalancheFuji, baseSepolia, ethereum, polygon, sepolia } from "thirdweb/chains";
import {
	ConnectButton,
	ConnectEmbed,
	lightTheme,
	useActiveAccount,
	useActiveWallet,
	useConnect,
	useDisconnect,
} from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";
import { createWallet } from "thirdweb/wallets";
import {
	getUserEmail,
	hasStoredPasskey,
	inAppWallet,
} from "thirdweb/wallets/in-app";

const customTheme = lightTheme({
 colors: {
   modalBg: 'red'
 }});

const thirdwebAuth = createAuth({
	domain: "localhost:3000",
	client,
});

// fake login state, this should be returned from the backend
let isLoggedIn = false;

export default function HomeScreen() {
	const [selectedChain, setSelectedChain] = useState(avalancheFuji);
	const [showQRGenerator, setShowQRGenerator] = useState(false);
	const activeWallet = useActiveWallet();
	const account = useActiveAccount(); // This gives you the wallet address!
    const { disconnect } = useDisconnect();
    const { connect } = useConnect();
	
	const handleChainChange = async (newChain:any) => {
        const wasConnected = !!activeWallet;
        const currentWalletId = activeWallet?.id;
        
        if (wasConnected) {
            // Store connection info
            const connectionInfo = {
                walletId: currentWalletId,
                // Store any other relevant connection data
            };
            
            // Disconnect current wallet
            // await disconnect(activeWallet);
            
            // Update chain
            setSelectedChain(newChain);
            
            // Auto-reconnect with new chain (small delay to ensure state updates)
            setTimeout(async () => {
                if (connectionInfo.walletId === "inApp") {
                    // Reconnect inApp wallet with new chain
                    connect(async () => {
                        const w = inAppWallet({
                            auth: {
                                options: [
                                    "google", "facebook", "discord", 
                                    "telegram", "email", "phone", "passkey"
                                ],
                                passkeyDomain: "thirdweb.com",
                            },
                            smartAccount: {
                                chain: newChain,
                                sponsorGas: true,
                            },
                        });
                        // This should auto-connect to the previously used method
                        await w.autoConnect({ client });
                        return w;
                    });
                }
            }, 100);
        } else {
            // Just update chain if not connected
            setSelectedChain(newChain);
        }
    };
    
    // Chain options for the picker
    const chainOptions = [
        { value: avalancheFuji, label: "Avalanche Fuji", id: "avalancheFuji" },
        { value: sepolia, label: "Sepolia", id: "sepolia" },
        { value: baseSepolia, label: "Base Sepolia", id: "baseSepolia" },
        { value: polygon, label: "Polygon", id: "polygon" },
        { value: ethereum, label: "Ethereum", id: "ethereum" },
    ];

	const wallets = useMemo(() => [
		inAppWallet({
			auth: {
				options: [
					"google",
					"facebook",
					"discord",
					"telegram",
					"email",
					"phone",
					"passkey",
				],
				passkeyDomain: "thirdweb.com",
			},
			smartAccount: {
				chain: selectedChain, // Now dynamic!
				sponsorGas: true,
			},
		}),
		createWallet("io.metamask"),
		createWallet("com.coinbase.wallet", {
			appMetadata: {
				name: "Thirdweb RN Demo",
			},
			mobileConfig: {
				callbackURL: "com.thirdweb.demo://",
			},
			walletConfig: {
				options: "smartWalletOnly",
			},
		}),
		createWallet("me.rainbow"),
		createWallet("com.trustwallet.app"),
		createWallet("io.zerion.wallet"),
	], [selectedChain]); // Recreate wallets when chain changes
	
	const theme = useColorScheme();
	
	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
			headerImage={
				<Image
					source={require("@/assets/images/title.png")}
					style={styles.reactLogo}
				/>
			}
		>
			<ThemedView style={styles.titleContainer}>
				<ThemedText type="title">Crypto Payment System</ThemedText>
			</ThemedView>
			
			{/* Toggle between wallet connection and QR generator */}
			<View style={styles.navigationContainer}>
				<ThemedButton
					title="Wallet Connection"
					variant={!showQRGenerator ? "primary" : "secondary"}
					onPress={() => setShowQRGenerator(false)}
				/>
				<ThemedButton
					title="Generate QR Code"
					variant={showQRGenerator ? "primary" : "secondary"}
					onPress={() => setShowQRGenerator(true)}
				/>
			</View>
			
			{!showQRGenerator ? (
				// Wallet Connection Screen
				<>
					<View style={{ gap: 2 }}>
						<ThemedText type="subtitle">{`<ConnectButton />`}</ThemedText>
						<ThemedText type="subtext">
							Configurable button + modal, handles both connection and connected
							state. Example below has Smart Accounts + sponsored transactions
							enabled.
						</ThemedText>
					</View>
					
					<View style={{ gap: 8, marginVertical: 16 }}>
						<ThemedText type="subtitle">Select Network</ThemedText>
						<View style={{ 
							flexDirection: 'row', 
							flexWrap: 'wrap', 
							gap: 8,
							paddingVertical: 8 
						}}>
							{chainOptions.map((chain) => (
								<ThemedButton
									key={chain.id}
									title={chain.label}
									variant={selectedChain.id === chain.value.id ? "primary" : "secondary"}
									onPress={() => handleChainChange(chain.value)}
								/>
							))}
						</View>
						<ThemedText type="subtext">
							Current Smart Account Chain: {chainOptions.find(c => c.value.id === selectedChain.id)?.label}
						</ThemedText>
					</View>
					
					<ConnectButton
						client={client}
						theme={theme || "light"}
						wallets={wallets}
						chain={selectedChain} // Use selected chain as default
						chains={[sepolia, baseSepolia, polygon, avalancheFuji, ethereum]}
					/>
					
					<CustomConnectUI />
				</>
			) : (
				// QR Code Generator Screen - Pass wallet data as props
				<QRCodeGenerator 
					connectedWalletAddress={account?.address}
					isWalletConnected={!!account}
				/>
			)}
		</ParallaxScrollView>
	);
}

const CustomConnectUI = () => {
	const wallet = useActiveWallet();
	const account = useActiveAccount();
	const [email, setEmail] = useState<string | undefined>();
	const { disconnect } = useDisconnect();
	useEffect(() => {
		if (wallet && wallet.id === "inApp") {
			getUserEmail({ client }).then(setEmail);
		}
	}, [wallet]);

	return wallet && account ? (
		<View>
			<ThemedText>Connected as {shortenAddress(account.address)}</ThemedText>
			{email && <ThemedText type="subtext">{email}</ThemedText>}
			<View style={{ height: 16 }} />
			<ThemedButton onPress={() => disconnect(wallet)} title="Disconnect" />
		</View>
	) : (
		<>
			<ConnectWithGoogle />
			<ConnectWithMetaMask />
			<ConnectWithPasskey />
		</>
	);
};

const ConnectWithGoogle = () => {
	const { connect, isConnecting } = useConnect();
	return (
		<ThemedButton
			title="Connect with Google"
			loading={isConnecting}
			loadingTitle="Connecting..."
			onPress={() => {
				connect(async () => {
					const w = inAppWallet({
						smartAccount: {
							chain,
							sponsorGas: true,
						},
					});
					await w.connect({
						client,
						strategy: "google",
					});
					return w;
				});
			}}
		/>
	);
};

const ConnectWithMetaMask = () => {
	const { connect, isConnecting } = useConnect();
	return (
		<ThemedButton
			title="Connect with MetaMask"
			variant="secondary"
			loading={isConnecting}
			loadingTitle="Connecting..."
			onPress={() => {
				connect(async () => {
					const w = createWallet("io.metamask");
					await w.connect({
						client,
					});
					return w;
				});
			}}
		/>
	);
};

const ConnectWithPasskey = () => {
	const { connect } = useConnect();
	return (
		<ThemedButton
			title="Login with Passkey"
			onPress={() => {
				connect(async () => {
					const hasPasskey = await hasStoredPasskey(client);
					const w = inAppWallet({
						auth: {
							options: ["passkey"],
							passkeyDomain: "thirdweb.com",
						},
					});
					await w.connect({
						client,
						strategy: "passkey",
						type: hasPasskey ? "sign-in" : "sign-up",
					});
					return w;
				});
			}}
		/>
	);
};

const styles = StyleSheet.create({
	titleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	navigationContainer: {
		flexDirection: 'row',
		gap: 10,
		marginVertical: 20,
		justifyContent: 'center',
	},
	stepContainer: {
		gap: 8,
		marginBottom: 8,
	},
	reactLogo: {
		height: "100%",
		width: "100%",
		bottom: 0,
		left: 0,
		position: "absolute",
	},
	rowContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 24,
		justifyContent: "space-evenly",
	},
	tableContainer: {
		width: "100%",
	},
	tableRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 4,
	},
	leftColumn: {
		flex: 1,
		textAlign: "left",
	},
	rightColumn: {
		flex: 1,
		textAlign: "right",
	},
});