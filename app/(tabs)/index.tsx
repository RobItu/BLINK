import { Image, StyleSheet, View, useColorScheme, TouchableOpacity } from "react-native";
import { ParallaxScrollView } from "@/components/ParallaxScrollView";
import { ThemedButton } from "@/components/ThemedButton";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { QRCodeGenerator } from "@/components/QRCodeGenerator";
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

// Network icon helper function
const getNetworkIcon = (networkName: string) => {
  const iconMap: { [key: string]: any } = {
    'Sepolia': require('../../assets/images/networks/sepolia.png'),
    'Polygon': require('../../assets/images/networks/polygon.png'),
    'Avalanche Fuji': require('../../assets/images/networks/avalancheFuji.png'),
    'Base Sepolia': require('../../assets/images/networks/baseSepolia.png'),
    'Arbitrum': require('../../assets/images/networks/arbitrum.png'),
    'Ethereum': require('../../assets/images/networks/ethereum.png'),
    'Avalanche': require('../../assets/images/networks/avalancheFuji.png'),
    'USDC': require('../../assets/images/networks/tokens/USDC.png'),
    'cbBTC': require('../../assets/images/networks/tokens/cbBTC.png'),
    'GUN': require('../../assets/images/networks/tokens/GUN.png'),
  };
  return iconMap[networkName] || require('../../assets/images/networks/sepolia.png');
};

// fake login state, this should be returned from the backend
let isLoggedIn = false;

export default function HomeScreen() {
	const [selectedChain, setSelectedChain] = useState(avalancheFuji);
	const [showQRGenerator, setShowQRGenerator] = useState(false);
	const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
	const activeWallet = useActiveWallet();
	const account = useActiveAccount();
    const { disconnect } = useDisconnect();
    const { connect } = useConnect();
	
	const handleChainChange = async (newChain: any) => {
        const wasConnected = !!activeWallet;
        const currentWalletId = activeWallet?.id;
        
        if (wasConnected) {
            const connectionInfo = {
                walletId: currentWalletId,
            };
            
            setSelectedChain(newChain);
            
            setTimeout(async () => {
                if (connectionInfo.walletId === "inApp") {
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
                        await w.autoConnect({ client });
                        return w;
                    });
                }
            }, 100);
        } else {
            setSelectedChain(newChain);
        }
    };
    
    // Chain options for the picker with proper naming
    const chainOptions = [
        { value: avalancheFuji, label: "Avalanche Fuji", shortLabel: "AVAX", id: "avalancheFuji" },
        { value: sepolia, label: "Sepolia", shortLabel: "SEP", id: "sepolia" },
        { value: baseSepolia, label: "Base Sepolia", shortLabel: "BASE", id: "baseSepolia" },
        { value: polygon, label: "Polygon", shortLabel: "MATIC", id: "polygon" },
        { value: ethereum, label: "Ethereum", shortLabel: "ETH", id: "ethereum" },
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
				chain: selectedChain,
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
	], [selectedChain]);
	
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
			{/* Settings Gear in Top Right */}
			<View style={styles.headerControls}>
				<TouchableOpacity
					style={styles.topSettingsButton}
					onPress={() => setNetworkDropdownOpen(!networkDropdownOpen)}
					activeOpacity={0.7}
				>
					<ThemedText style={[
						styles.topSettingsIcon,
						networkDropdownOpen && styles.topSettingsIconActive
					]}>
						⚙️
					</ThemedText>
				</TouchableOpacity>
			</View>

			<ThemedView style={styles.titleContainer}>
				<ThemedText type="title">Crypto Payment System</ThemedText>
			</ThemedView>
			
			{/* Clean Navigation Tabs */}
			<View style={styles.modernTabContainer}>
				<View style={styles.tabSelector}>
					<TouchableOpacity
						style={[
							styles.modernTab,
							!showQRGenerator && styles.modernTabActive
						]}
						onPress={() => setShowQRGenerator(false)}
						activeOpacity={0.8}
					>
						<View style={styles.tabIconContainer}>
							<ThemedText style={[
								styles.tabIcon,
								!showQRGenerator && styles.tabIconActive
							]}>
								💳
							</ThemedText>
						</View>
						<ThemedText style={[
							styles.tabText,
							!showQRGenerator && styles.tabTextActive
						]}>
							Wallet
						</ThemedText>
					</TouchableOpacity>
					
					<TouchableOpacity
						style={[
							styles.modernTab,
							showQRGenerator && styles.modernTabActive
						]}
						onPress={() => setShowQRGenerator(true)}
						activeOpacity={0.8}
					>
						<View style={styles.tabIconContainer}>
							<ThemedText style={[
								styles.tabIcon,
								showQRGenerator && styles.tabIconActive
							]}>
								📱
							</ThemedText>
						</View>
						<ThemedText style={[
							styles.tabText,
							showQRGenerator && styles.tabTextActive
						]}>
							QR Code
						</ThemedText>
					</TouchableOpacity>
				</View>
			</View>
			
			{!showQRGenerator ? (
				// Wallet Connection Screen
				<>
					{/* Hidden Network Dropdown - Only shows when settings gear is pressed */}
					{networkDropdownOpen && (
						<View style={styles.networkDropdownSection}>
							<TouchableOpacity 
								style={styles.networkDropdownHeader}
								onPress={() => setNetworkDropdownOpen(!networkDropdownOpen)}
								activeOpacity={0.7}
							>
								<View style={styles.networkDropdownLeft}>
									<Image 
										source={getNetworkIcon(chainOptions.find(c => c.value.id === selectedChain.id)?.label || '')} 
										style={styles.networkDropdownIcon}
										resizeMode="contain"
									/>
									<View style={styles.networkDropdownText}>
										<ThemedText type="subtext" style={styles.networkDropdownLabel}>Network</ThemedText>
										<ThemedText style={styles.networkDropdownValue}>
											{chainOptions.find(c => c.value.id === selectedChain.id)?.label}
										</ThemedText>
									</View>
								</View>
								<ThemedText style={[styles.networkDropdownArrow, networkDropdownOpen && styles.networkDropdownArrowOpen]}>
									▼
								</ThemedText>
							</TouchableOpacity>
							
							{networkDropdownOpen && (
								<View style={styles.networkDropdownMenu}>
									{chainOptions.map((chain) => (
										<TouchableOpacity
											key={chain.id}
											style={[
												styles.networkDropdownItem,
												selectedChain.id === chain.value.id && styles.networkDropdownItemSelected
											]}
											onPress={() => {
												handleChainChange(chain.value);
												setNetworkDropdownOpen(false);
											}}
											activeOpacity={0.7}
										>
											<Image 
												source={getNetworkIcon(chain.label)} 
												style={styles.networkDropdownItemIcon}
												resizeMode="contain"
											/>
											<ThemedText style={[
												styles.networkDropdownItemText,
												selectedChain.id === chain.value.id && styles.networkDropdownItemTextSelected
											]}>
												{chain.label}
											</ThemedText>
											{selectedChain.id === chain.value.id && (
												<ThemedText style={styles.networkDropdownItemCheck}>✓</ThemedText>
											)}
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>
					)}
					
					<ConnectButton
						client={client}
						theme={theme || "light"}
						wallets={wallets}
						chain={selectedChain}
						chains={[sepolia, baseSepolia, polygon, avalancheFuji, ethereum]}
					/>
					
					<CustomConnectUI />
				</>
			) : (
				// QR Code Generator Screen
				<QRCodeGenerator 
					connectedWalletAddress={account?.address}
					isWalletConnected={!!account}
					merchantId={account?.address || 'demo_merchant'}
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
	// Header Controls Styles
	headerControls: {
		position: 'absolute',
		top: 16,
		right: 20,
		zIndex: 10,
	},
	topSettingsButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255, 255, 255, 0.9)',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.2)',
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 3,
	},
	topSettingsIcon: {
		fontSize: 18,
	},
	topSettingsIconActive: {
		fontSize: 18,
	},
	// Modern Tab Styles (cleaned up)
	modernTabContainer: {
		marginVertical: 24,
		paddingHorizontal: 20,
	},
	tabSelector: {
		flexDirection: 'row',
		backgroundColor: '#F1F5F9',
		borderRadius: 16,
		padding: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2,
	},
	modernTab: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderRadius: 12,
		backgroundColor: 'transparent',
	},
	modernTabActive: {
		backgroundColor: '#FFFFFF',
		shadowColor: '#375BD2',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 6,
		elevation: 3,
	},
	tabIconContainer: {
		marginRight: 8,
	},
	tabIcon: {
		fontSize: 18,
	},
	tabIconActive: {
		fontSize: 18,
	},
	tabText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#64748B',
	},
	tabTextActive: {
		color: '#375BD2',
		fontWeight: '700',
	},
	// Network Dropdown Styles
	networkDropdownSection: {
		marginVertical: 16,
	},
	networkDropdownHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#F8FAFC',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	networkDropdownLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	networkDropdownIcon: {
		width: 24,
		height: 24,
		marginRight: 12,
	},
	networkDropdownText: {
		flex: 1,
	},
	networkDropdownLabel: {
		fontSize: 12,
		color: '#64748B',
		marginBottom: 2,
	},
	networkDropdownValue: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1E293B',
	},
	networkDropdownArrow: {
		fontSize: 12,
		color: '#64748B',
		marginLeft: 8,
	},
	networkDropdownArrowOpen: {
		transform: [{ rotate: '180deg' }],
	},
	networkDropdownMenu: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E2E8F0',
		marginTop: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 4,
	},
	networkDropdownItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#F1F5F9',
	},
	networkDropdownItemSelected: {
		backgroundColor: '#EEF2FF',
	},
	networkDropdownItemIcon: {
		width: 20,
		height: 20,
		marginRight: 12,
	},
	networkDropdownItemText: {
		flex: 1,
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
	},
	networkDropdownItemTextSelected: {
		color: '#375BD2',
		fontWeight: '600',
	},
	networkDropdownItemCheck: {
		fontSize: 16,
		color: '#375BD2',
		fontWeight: 'bold',
	},
	// Keep existing styles
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